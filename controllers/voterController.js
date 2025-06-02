const { ethers } = require('ethers');
const {
  registerVoter: registerVoterOnBlockchain,
  verifyVoter: verifyVoterOnBlockchain,
  checkVoterStatus,
  getVoterDetails
} = require('../utils/blockchain');
const {
  encryptSensitiveData,
  decryptSensitiveData,
  createBlockchainHashes
} = require('../utils/crypto');
const Voter = require('../models/Voter');
const AdminLog = require('../models/AdminLog');
const { logAdminActivity } = require('./adminController');

// Register a voter (Step 1)
const registerVoter = async (req, res) => {
  console.log("Received voter registration request:", req.body);
  try {
    // Check for required environment variables
    if (!process.env.ADMIN_ADDRESS) {
      console.error("ADMIN_ADDRESS environment variable not set");
      return res.status(500).json({ error: "Server configuration error - admin address not configured" });
    }

    // Extract fields from request body
    const {
      name,
      aadharNumber: reqAadharNumber,
      address, // This is the wallet address
      phoneNumber,
      email,
      city,
      state,
      gender,
      dob,
      aadharImageUrl
    } = req.body;

    // Map to the expected format and ensure values
    const blockchainAddress = address;
    const district = city && state ? `${city}, ${state}` : "";
    // Ensure we have the aadharNumber (could be named differently in request)
    const aadharNumber = reqAadharNumber || req.body.aadhaar || req.body.aadhar;

    // Validate required fields with detailed error messages
    if (!name) {
      return res.status(400).json({ error: "Missing required fields", details: "name is required" });
    }

    if (!aadharNumber) {
      return res.status(400).json({ error: "Missing required fields", details: "aadharNumber is required" });
    }

    if (!blockchainAddress) {
      return res.status(400).json({ error: "Missing required fields", details: "address is required" });
    }

    // Validate Ethereum address format
    if (!blockchainAddress.startsWith('0x') || blockchainAddress.length !== 42) {
      console.log("Invalid Ethereum address format:", blockchainAddress);
      return res.status(400).json({ error: "Invalid Ethereum address format" });
    }

    try {
      // Create proper hashes for blockchain storage
      console.log("Creating blockchain hashes");
      const { nameHash, aadharHash } = createBlockchainHashes({ name, aadharNumber });
      console.log("Generated hashes:", {
        nameHash,
        aadharHash,
        nameHashLength: nameHash.length,
        aadharHashLength: aadharHash.length
      });

      // Check if voter already exists in MongoDB
      const existingVoter = await Voter.findOne({
        $or: [
          { blockchainAddress: blockchainAddress },
          { 'rawData.aadharNumber': aadharNumber }
        ]
      });

      if (existingVoter) {
        console.log("Voter already exists in MongoDB:", {
          id: existingVoter._id,
          blockchainAddress: existingVoter.blockchainAddress
        });
        return res.status(400).json({ error: "Voter already registered" });
      }

      // Attempt to register on blockchain
      let blockchainResult = null;
      try {
        console.log("Attempting blockchain registration");
        blockchainResult = await registerVoterOnBlockchain(nameHash, aadharHash, blockchainAddress);
        console.log("Blockchain registration successful:", blockchainResult?.hash || "No hash returned");
      } catch (blockchainError) {
        console.warn("Blockchain registration skipped/failed:", blockchainError.message);
        // We'll continue with MongoDB registration anyway
      }

      // Encrypt sensitive data for MongoDB storage
      console.log("Encrypting sensitive data for MongoDB");
      try {
        const encryptedData = encryptSensitiveData({
          name,
          aadharNumber,
          phoneNumber,
          email
        });

        // Check if aadhar image was uploaded
        let aadharImagePath = aadharImageUrl;
        if (req.file) {
          aadharImagePath = req.file.path;
          console.log("Aadhar image uploaded via file upload:", aadharImagePath);
        }
        console.log("Using aadhar image path:", aadharImagePath);

        // Create MongoDB record
        console.log("Creating MongoDB record");
        const voter = new Voter({
          blockchainAddress,
          encryptedData,
          rawData: {
            name: name,
            aadharNumber: aadharNumber
          },
          blockchain: blockchainResult ? {
            nameHash,
            aadharHash,
            txHash: blockchainResult.hash,
            registrationTimestamp: Date.now()
          } : null,
          district,
          gender,
          dob: new Date(dob),
          aadharImage: aadharImagePath
        });

        await voter.save();

        console.log("Voter registration complete");
        return res.status(201).json({
          message: "Voter registered successfully",
          blockchainAddress,
          blockchainTxHash: blockchainResult?.hash || null,
          onBlockchain: !!blockchainResult
        });
      } catch (encryptionError) {
        console.error("Encryption or database error:", encryptionError);
        return res.status(500).json({
          error: "Registration failed",
          details: encryptionError.message
        });
      }
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({
        error: "Registration failed",
        details: error.message
      });
    }
  } catch (error) {
    console.error("Voter registration error:", error);
    return res.status(500).json({ error: "Registration failed", details: error.message });
  }
};

// Verify a voter (admin only)
const verifyVoter = async (req, res) => {
  try {
    const { adminAddress, voterAddress, verificationNotes } = req.body;

    // Validate inputs
    if (!adminAddress || !voterAddress) {
      return res.status(400).json({ error: "Both adminAddress and voterAddress are required" });
    }

    // Validate address formats
    if (!ethers.isAddress(adminAddress) || !ethers.isAddress(voterAddress)) {
      return res.status(400).json({ error: "Invalid Ethereum address format" });
    }

    // Verify against configured admin
    if (adminAddress.toLowerCase() !== process.env.ADMIN_ADDRESS.toLowerCase()) {
      return res.status(403).json({ error: "Unauthorized. Not an admin address." });
    }

    // Try blockchain verification first if possible
    let blockchainResult = null;
    try {
      console.log("Attempting blockchain verification");
      blockchainResult = await verifyVoterOnBlockchain(voterAddress);
      console.log("Blockchain verification successful:", blockchainResult?.hash || "No hash returned");
    } catch (blockchainError) {
      console.warn("Blockchain verification skipped/failed:", blockchainError.message);
      // We'll continue with MongoDB verification anyway
    }

    // Update MongoDB record
    const voter = await Voter.findOne({ blockchainAddress: voterAddress });

    if (!voter) {
      return res.status(404).json({ error: "Voter not found" });
    }

    voter.isVerified = true;
    voter.verificationDate = new Date();
    voter.verificationNotes = verificationNotes || "";
    voter.verifiedBy = adminAddress;

    // Add blockchain verification details if available
    if (blockchainResult && blockchainResult.hash) {
      voter.blockchain = voter.blockchain || {};
      voter.blockchain.verificationTxHash = blockchainResult.hash;
      voter.blockchain.lastVerifiedTimestamp = Date.now();
    }

    await voter.save();

    // Log admin activity
    await logAdminActivity(
      adminAddress,
      'VERIFY_VOTER',
      `Admin verified voter ${voterAddress}`,
      voterAddress,
      blockchainResult?.hash || null,
      'SUCCESS',
      { message: "Direct database verification (blockchain verification)" },
      req.ip
    );

    res.json({
      message: "Voter verified successfully",
      verificationDate: voter.verificationDate
    });
  } catch (error) {
    console.error("Verification error:", error);

    // Log failed attempt
    if (req.body.adminAddress && req.body.voterAddress) {
      try {
        await logAdminActivity(
          req.body.adminAddress,
          'VERIFY_VOTER',
          `Failed to verify voter ${req.body.voterAddress}: ${error.message}`,
          req.body.voterAddress,
          null,
          'FAILURE',
          { error: error.message },
          req.ip
        );
      } catch (logError) {
        console.error("Error logging admin activity:", logError);
      }
    }

    // Handle specific blockchain errors
    if (error.message && error.message.includes("Voter not registered")) {
      return res.status(404).json({ error: "Voter not registered" });
    }

    if (error.message && error.message.includes("Voter already verified")) {
      return res.status(409).json({ error: "Voter already verified" });
    }

    res.status(500).json({ error: "Verification failed", details: error.message });
  }
};

// Check voter status
const checkVoterStatusController = async (req, res) => {
  try {
    const { address } = req.params;

    // Validate address format
    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    // Check in MongoDB first for faster response
    const mongoVoter = await Voter.findOne({ blockchainAddress: address });

    if (mongoVoter) {
      return res.json({
        address,
        isVerified: mongoVoter.isVerified,
        source: "database"
      });
    }

    // If not in MongoDB, check blockchain
    const isVerified = await checkVoterStatus(address);

    res.json({
      address,
      isVerified,
      source: "blockchain"
    });
  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({ error: "Status check failed", details: error.message });
  }
};

// Get voter details
const getVoterDetailsController = async (req, res) => {
  try {
    const { address } = req.params;
    const { adminAddress } = req.query;

    // Validate address format
    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    // Check in MongoDB first for complete data
    const mongoVoter = await Voter.findOne({ blockchainAddress: address });

    if (mongoVoter) {
      // Determine if sensitive data should be decrypted
      // Only decrypt for the owner of the address or an admin
      const isAuthorized =
        adminAddress &&
        adminAddress.toLowerCase() === process.env.ADMIN_ADDRESS.toLowerCase();
      const isOwner = req.headers['x-voter-address'] === address;

      let responseData = {
        address,
        isVerified: mongoVoter.isVerified,
        registrationDate: mongoVoter.registrationDate,
        verificationDate: mongoVoter.verificationDate || null,
        aadharImageUrl: mongoVoter.aadharImageUrl,
        source: "database"
      };

      // If admin or owner, include decrypted data
      if (isAuthorized || isOwner) {
        const decryptedData = decryptSensitiveData(mongoVoter.encryptedData);
        responseData.profile = decryptedData;
      }

      return res.json(responseData);
    }

    // If not in MongoDB, get from blockchain
    const blockchainDetails = await getVoterDetails(address);

    // Format data
    const formattedDetails = {
      address,
      isVerified: blockchainDetails.isVerified,
      registrationDate: new Date(blockchainDetails.registrationTimestamp * 1000).toISOString(),
      verificationDate: blockchainDetails.lastVerifiedTimestamp ?
        new Date(blockchainDetails.lastVerifiedTimestamp * 1000).toISOString() : null,
      source: "blockchain"
    };

    res.json(formattedDetails);
  } catch (error) {
    console.error("Details fetch error:", error);
    res.status(500).json({ error: "Failed to fetch voter details", details: error.message });
  }
};

// Get voter data by admin (with decrypted data)
const getVoterByAdmin = async (req, res) => {
  try {
    const { address } = req.params;
    const adminAddress = req.headers['x-admin-address'] || req.query.adminAddress;

    // Validate inputs
    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid voter address" });
    }

    if (!adminAddress || !ethers.isAddress(adminAddress)) {
      return res.status(400).json({ error: "Invalid admin address" });
    }

    // Verify admin
    if (adminAddress.toLowerCase() !== process.env.ADMIN_ADDRESS.toLowerCase()) {
      return res.status(403).json({ error: "Unauthorized. Not an admin address." });
    }

    // Get voter from MongoDB
    const voter = await Voter.findOne({ blockchainAddress: address });

    if (!voter) {
      return res.status(404).json({ error: "Voter not found" });
    }

    // Decrypt sensitive data
    const decryptedData = decryptSensitiveData(voter.encryptedData);

    // Format response
    const response = {
      blockchainAddress: voter.blockchainAddress,
      profile: decryptedData,
      isVerified: voter.isVerified,
      registrationDate: voter.registrationDate,
      verificationDate: voter.verificationDate,
      aadharImageUrl: voter.aadharImageUrl,
      transactionHash: voter.transactionHash,
      blockNumber: voter.blockNumber,
      verificationNotes: voter.verificationNotes,
      verifiedBy: voter.verifiedBy
    };

    res.json(response);
  } catch (error) {
    console.error("Admin voter fetch error:", error);
    res.status(500).json({ error: "Failed to fetch voter data", details: error.message });
  }
};

module.exports = {
  registerVoter,
  verifyVoter,
  checkVoterStatus: checkVoterStatusController,
  getVoterDetails: getVoterDetailsController,
  getVoterByAdmin
};