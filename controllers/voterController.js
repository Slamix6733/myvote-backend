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

// Import wallet abstraction service
const WalletAbstractionService = require('../services/walletService');
const walletService = new WalletAbstractionService();

// Import QR code service
const qrCodeService = require('../services/qrCodeService');

// ========== EXISTING FUNCTIONS (Keep as is) ==========

// Register a voter (Step 1) - Original wallet-based registration
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

// Verify a voter (admin only) - Keep existing
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

    // Generate QR code after successful verification
    try {
      const qrResult = await qrCodeService.generateQRCodeForVoter({
        name: voter.rawData.name,
        aadharNumber: voter.rawData.aadharNumber,
        txHash: blockchainResult?.hash || 'manual_verification',
        voterAddress: voterAddress
      });

      // Update voter with QR code data
      voter.qrCode = {
        nameHash: qrResult.qrCodeData.nameHash,
        aadharHash: qrResult.qrCodeData.aadharHash,
        txHash: qrResult.qrCodeData.txHash,
        firebaseUrl: qrResult.firebaseUrl,
        fileName: qrResult.fileName,
        generatedAt: new Date()
      };
    } catch (qrError) {
      console.warn("QR code generation failed:", qrError.message);
      // Continue without QR code
    }

    voter.isVerified = true;
    voter.verificationDate = new Date();
    voter.verificationNotes = verificationNotes || "";
    voter.verifiedBy = adminAddress;

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
      verificationDate: voter.verificationDate,
      qrCodeGenerated: !!voter.qrCode?.firebaseUrl,
      qrCodeUrl: voter.qrCode?.firebaseUrl || null
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

// Check voter status - Keep existing
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

// Get voter details - Keep existing
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

// Get voter data by admin - Keep existing
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

// ========== NEW WALLET ABSTRACTION FUNCTIONS ==========

// Register voter with Aadhar number only (no wallet needed)
const registerVoterWithAadhar = async (req, res) => {
  console.log("Received Aadhar-based voter registration request:", req.body);
  try {
    const {
      name,
      aadharNumber,
      dob,
      phoneNumber,
      email,
      city,
      state,
      gender
    } = req.body;

    // Validate required fields
    if (!name || !aadharNumber) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "name and aadharNumber are required"
      });
    }

    // Check if voter already exists by Aadhar
    const existingVoter = await Voter.findOne({
      'rawData.aadharNumber': aadharNumber
    });

    if (existingVoter) {
      return res.status(400).json({
        error: 'Voter already registered with this Aadhar number'
      });
    }

    // Generate wallet automatically
    const walletData = walletService.generateWalletFromAadhar(aadharNumber);
    console.log("Generated wallet for Aadhar voter:", walletData.address);

    // Fund the wallet with gas money
    let fundingTxHash = null;
    try {
      fundingTxHash = await walletService.fundWallet(walletData.address);
      console.log("Funded wallet with tx:", fundingTxHash);
    } catch (fundError) {
      console.warn("Failed to fund wallet:", fundError.message);
      // Continue anyway - user can fund later
    }

    // Create blockchain hashes
    const { nameHash, aadharHash } = createBlockchainHashes({ name, aadharNumber });

    // Register on blockchain (optional - continue if fails)
    let blockchainResult = null;
    try {
      blockchainResult = await registerVoterOnBlockchain(nameHash, aadharHash, walletData.address);
      console.log("Blockchain registration successful for Aadhar voter");
    } catch (blockchainError) {
      console.warn("Blockchain registration failed for Aadhar voter:", blockchainError.message);
    }

    // Encrypt sensitive data
    const encryptedData = encryptSensitiveData({
      name,
      aadharNumber,
      phoneNumber,
      email,
      dob,
      // Store wallet abstraction data in encrypted format
      walletAbstraction: {
        encryptedPrivateKey: walletService.encryptPrivateKey(walletData.privateKey, aadharNumber),
        fundingTxHash
      }
    });

    // Store in MongoDB using existing schema
    const voter = new Voter({
      blockchainAddress: walletData.address,
      encryptedData,
      rawData: {
        name,
        aadharNumber
      },
      blockchain: {
        nameHash,
        aadharHash: ethers.keccak256(ethers.toUtf8Bytes(aadharNumber)),
        txHash: blockchainResult?.hash || null,
        registrationTimestamp: Date.now()
      },
      district: `${city || ''}, ${state || ''}`.trim().replace(/^,\s*|,\s*$/g, ''),
      gender,
      dob: dob ? new Date(dob) : null
    });

    await voter.save();

    console.log("Aadhar-based voter registration complete");
    res.status(201).json({
      message: 'Voter registered successfully with Aadhar',
      voterAddress: walletData.address,
      blockchainTxHash: blockchainResult?.hash || null,
      fundingTxHash,
      registrationId: voter._id,
      registrationMethod: 'aadhar'
    });

  } catch (error) {
    console.error('Aadhar registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      details: error.message
    });
  }
};

// Get voter by Aadhar number
const getVoterByAadhar = async (req, res) => {
  try {
    const { aadharNumber } = req.params;

    const voter = await Voter.findOne({
      'rawData.aadharNumber': aadharNumber
    });

    if (!voter) {
      return res.status(404).json({ error: 'Voter not found' });
    }

    res.json({
      registrationId: voter._id,
      blockchainAddress: voter.blockchainAddress,
      isVerified: voter.isVerified,
      registrationDate: voter.createdAt,
      verificationDate: voter.verificationDate,
      district: voter.district,
      gender: voter.gender,
      name: voter.rawData?.name,
      registrationMethod: 'aadhar'
    });

  } catch (error) {
    console.error('Aadhar lookup error:', error);
    res.status(500).json({
      error: 'Lookup failed',
      details: error.message
    });
  }
};

// Check registration status by Aadhar
const checkStatusByAadhar = async (req, res) => {
  try {
    const { aadharNumber } = req.params;

    const voter = await Voter.findOne({
      'rawData.aadharNumber': aadharNumber
    });

    if (!voter) {
      return res.json({
        isRegistered: false,
        message: 'No registration found for this Aadhar number'
      });
    }

    res.json({
      isRegistered: true,
      isVerified: voter.isVerified,
      blockchainAddress: voter.blockchainAddress,
      registrationDate: voter.createdAt,
      verificationDate: voter.verificationDate,
      registrationMethod: 'aadhar'
    });

  } catch (error) {
    console.error('Aadhar status check error:', error);
    res.status(500).json({
      error: 'Status check failed',
      details: error.message
    });
  }
};

// Add new function to verify voter by Aadhar (admin only)
const verifyVoterByAadhar = async (req, res) => {
  try {
    const { aadharNumber } = req.params;
    const { verificationNotes } = req.body;
    const adminAddress = req.headers['x-admin-address'] || req.query.adminAddress || req.body.adminAddress;

    // Find voter by Aadhar
    const voter = await Voter.findOne({ 'rawData.aadharNumber': aadharNumber });

    if (!voter) {
      return res.status(404).json({ error: "Voter not found" });
    }

    if (voter.isVerified) {
      return res.status(400).json({ error: "Voter already verified" });
    }

    // Update verification status
    voter.isVerified = true;
    voter.verificationDate = new Date();
    voter.verificationNotes = verificationNotes || "";
    voter.verifiedBy = adminAddress;

    // Generate QR code after verification
    try {
      const qrResult = await qrCodeService.generateQRCodeForVoter({
        name: voter.rawData.name,
        aadharNumber: voter.rawData.aadharNumber,
        txHash: 'aadhar_verification',
        voterAddress: voter.blockchainAddress
      });

      voter.qrCode = {
        nameHash: qrResult.qrCodeData.nameHash,
        aadharHash: qrResult.qrCodeData.aadharHash,
        txHash: qrResult.qrCodeData.txHash,
        firebaseUrl: qrResult.firebaseUrl,
        fileName: qrResult.fileName,
        generatedAt: new Date()
      };
    } catch (qrError) {
      console.warn("QR code generation failed:", qrError.message);
    }

    await voter.save();

    // Log admin activity
    await logAdminActivity(
      adminAddress,
      'VERIFY_VOTER_BY_AADHAR',
      `Admin verified voter with Aadhar ${aadharNumber}`,
      voter.blockchainAddress,
      null,
      'SUCCESS',
      { message: "Aadhar-based voter verification" },
      req.ip
    );

    res.json({
      message: "Voter verified successfully",
      blockchainAddress: voter.blockchainAddress,
      verificationDate: voter.verificationDate,
      registrationMethod: 'aadhar'
    });

  } catch (error) {
    console.error("Aadhar verification error:", error);
    res.status(500).json({
      error: "Verification failed",
      details: error.message
    });
  }
};

// Add new function for generating voting QR
const generateVotingQR = async (req, res) => {
  try {
    const { aadharNumber } = req.params;
    const { expirationMinutes = 30 } = req.body;

    // Find voter by Aadhar
    const voter = await Voter.findOne({ 'rawData.aadharNumber': aadharNumber });

    if (!voter) {
      return res.status(404).json({ error: "Voter not found" });
    }

    if (!voter.isVerified) {
      return res.status(400).json({ error: "Voter is not verified" });
    }

    if (voter.isVoted) {
      return res.status(400).json({ error: "Voter has already voted" });
    }

    // Generate new QR code with expiration
    const qrResult = await qrCodeService.generateQRCodeForVoter({
      nameHash: voter.blockchain?.nameHash,
      aadharHash: voter.blockchain?.aadharHash,
      txHash: voter.blockchain?.txHash || 'voting_qr',
      blockchainAddress: voter.blockchainAddress,
      voterAddress: voter.blockchainAddress
    }, expirationMinutes);

    // Update voter with new QR code
    voter.qrCode = {
      nameHash: qrResult.qrCodeData.nameHash,
      aadharHash: qrResult.qrCodeData.aadharHash,
      txHash: qrResult.qrCodeData.txHash,
      firebaseUrl: qrResult.firebaseUrl,
      fileName: qrResult.fileName,
      generatedAt: new Date(),
      expiresAt: qrResult.expiresAt,
      isActive: true
    };

    await voter.save();

    res.json({
      message: "Voting QR code generated successfully",
      qrCodeUrl: qrResult.firebaseUrl,
      expiresAt: qrResult.expiresAt,
      expirationMinutes
    });

  } catch (error) {
    console.error("QR generation error:", error);
    res.status(500).json({
      error: "Failed to generate voting QR code",
      details: error.message
    });
  }
};

// Add function to process vote via QR scan
const processVoteViaScan = async (req, res) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({ error: "QR data is required" });
    }

    const result = await qrCodeService.processVoting(qrData);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      message: result.message,
      voterAddress: result.voterAddress,
      votingDate: result.votingDate
    });

  } catch (error) {
    console.error("Vote processing error:", error);
    res.status(500).json({
      error: "Failed to process vote",
      details: error.message
    });
  }
};

// ========== EXPORTS ==========
module.exports = {
  // Existing wallet-based functions
  registerVoter,
  verifyVoter,
  checkVoterStatus: checkVoterStatusController,
  getVoterDetails: getVoterDetailsController,
  getVoterByAdmin,

  // New wallet abstraction functions
  registerVoterWithAadhar,
  getVoterByAadhar,
  checkStatusByAadhar,

  // New Aadhar verification function
  verifyVoterByAadhar,

  // New QR code functions
  generateVotingQR,
  processVoteViaScan
};