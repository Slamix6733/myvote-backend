const { ethers } = require('ethers');
const { 
  registerVoter: registerVoterOnBlockchain,
  verifyVoter: verifyVoterOnBlockchain,
  checkVoterStatus,
  getVoterDetails
} = require('../utils/blockchain');
const Voter = require('../models/Voter');
const AdminLog = require('../models/AdminLog');
const { logAdminActivity } = require('./adminController');

// Register a new voter
const registerVoter = async (req, res) => {
  try {
    const { 
      address, 
      name, 
      dob, 
      voterIdHash, 
      aadharNumber, 
      residentialAddress,
      district,
      state,
      pincode,
      gender,
      contactPhone,
      contactEmail,
      profilePhotoUrl
    } = req.body;
    
    // Validate inputs
    if (!address || !name || !dob || !voterIdHash || !aadharNumber || !residentialAddress) {
      return res.status(400).json({ error: "Required fields are missing" });
    }
    
    // Validate address format
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }
    
    // Check if voter already exists in MongoDB
    const existingVoter = await Voter.findOne({
      $or: [
        { blockchainAddress: address },
        { aadharNumber },
        { voterIdHash }
      ]
    });
    
    if (existingVoter) {
      let errorMessage = "Registration failed. ";
      
      if (existingVoter.blockchainAddress === address) {
        errorMessage += "Address already registered.";
      } else if (existingVoter.aadharNumber === aadharNumber) {
        errorMessage += "Aadhar number already registered.";
      } else if (existingVoter.voterIdHash === voterIdHash) {
        errorMessage += "Voter ID already registered.";
      }
      
      return res.status(409).json({ error: errorMessage });
    }
    
    // Convert DOB to timestamp if it's a date string
    let dobTimestamp = dob;
    if (typeof dob === 'string') {
      dobTimestamp = Math.floor(new Date(dob).getTime() / 1000);
      if (isNaN(dobTimestamp)) {
        return res.status(400).json({ error: "Invalid date of birth format" });
      }
    }
    
    // Call blockchain function to register voter
    const blockchainResponse = await registerVoterOnBlockchain(
      address, 
      name, 
      dobTimestamp, 
      voterIdHash, 
      aadharNumber, 
      residentialAddress
    );
    
    // Create MongoDB record
    const newVoter = new Voter({
      blockchainAddress: address,
      name,
      dob: new Date(dob),
      voterIdHash,
      aadharNumber,
      residentialAddress,
      district,
      state,
      pincode,
      gender,
      contactPhone,
      contactEmail,
      profilePhotoUrl,
      isVerified: false,
      registrationDate: new Date(),
      transactionHash: blockchainResponse.hash,
      blockNumber: blockchainResponse.blockNumber
    });
    
    await newVoter.save();
    
    res.status(201).json({
      message: "Voter registered successfully",
      transactionHash: blockchainResponse.hash,
      blockNumber: blockchainResponse.blockNumber,
      voter: newVoter
    });
  } catch (error) {
    console.error("Registration error:", error);
    
    // Handle specific blockchain errors
    if (error.message && error.message.includes("Already registered")) {
      return res.status(409).json({ error: "Voter already registered on blockchain" });
    }
    
    if (error.message && error.message.includes("registration is currently closed")) {
      return res.status(403).json({ error: "Voter registration is currently closed" });
    }
    
    if (error.message && error.message.includes("Aadhar number already registered")) {
      return res.status(409).json({ error: "Aadhar number already registered on blockchain" });
    }
    
    if (error.message && error.message.includes("Voter ID already registered")) {
      return res.status(409).json({ error: "Voter ID already registered on blockchain" });
    }
    
    res.status(500).json({ error: "Registration failed", details: error.message });
  }
};

// Verify a voter (admin only)
const verifyVoter = async (req, res) => {
  try {
    const { adminAddress, voterAddress } = req.body;
    
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
    
    // Call blockchain function to verify voter
    const blockchainResponse = await verifyVoterOnBlockchain(voterAddress);
    
    // Update MongoDB record
    const voter = await Voter.findOne({ blockchainAddress: voterAddress });
    
    if (voter) {
      voter.isVerified = true;
      voter.verificationDate = new Date();
      await voter.save();
    }
    
    // Log admin activity
    await logAdminActivity(
      adminAddress,
      'VERIFY_VOTER',
      `Admin verified voter ${voterAddress}`,
      voterAddress,
      blockchainResponse.hash,
      'SUCCESS',
      { blockNumber: blockchainResponse.blockNumber },
      req.ip
    );
    
    res.json({
      message: "Voter verified successfully",
      transactionHash: blockchainResponse.hash,
      blockNumber: blockchainResponse.blockNumber,
      voter
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
    
    // Validate address format
    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }
    
    // Check in MongoDB first for complete data
    const mongoVoter = await Voter.findOne({ blockchainAddress: address });
    
    if (mongoVoter) {
      return res.json({
        address,
        details: mongoVoter,
        source: "database"
      });
    }
    
    // If not in MongoDB, get from blockchain
    const blockchainDetails = await getVoterDetails(address);
    
    // Format data
    const formattedDetails = {
      name: blockchainDetails.name,
      dob: new Date(blockchainDetails.dob * 1000).toISOString().split('T')[0],
      isVerified: blockchainDetails.isVerified,
      residentialAddress: blockchainDetails.residentialAddress,
      registrationDate: new Date(blockchainDetails.registrationTimestamp * 1000).toISOString(),
      verificationDate: blockchainDetails.lastVerifiedTimestamp ? 
        new Date(blockchainDetails.lastVerifiedTimestamp * 1000).toISOString() : null
    };
    
    res.json({
      address,
      details: formattedDetails,
      source: "blockchain"
    });
  } catch (error) {
    console.error("Details fetch error:", error);
    res.status(500).json({ error: "Failed to fetch voter details", details: error.message });
  }
};

// Update voter profile (extended data only)
const updateVoterProfile = async (req, res) => {
  try {
    const { address } = req.params;
    const updates = req.body;
    
    // Validate address format
    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }
    
    // Find voter in MongoDB
    const voter = await Voter.findOne({ blockchainAddress: address });
    
    if (!voter) {
      return res.status(404).json({ error: "Voter not found" });
    }
    
    // Only allow updates to extended profile fields
    const allowedUpdates = [
      'district', 
      'state', 
      'pincode', 
      'gender', 
      'contactPhone', 
      'contactEmail', 
      'profilePhotoUrl'
    ];
    
    // Filter out disallowed updates
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });
    
    // Update voter
    Object.assign(voter, filteredUpdates);
    await voter.save();
    
    res.json({
      message: "Voter profile updated successfully",
      voter
    });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ error: "Profile update failed", details: error.message });
  }
};

module.exports = {
  registerVoter,
  verifyVoter,
  checkVoterStatus: checkVoterStatusController,
  getVoterDetails: getVoterDetailsController,
  updateVoterProfile
}; 