const express = require("express");
const router = express.Router();
const {
  registerVoter,
  verifyVoter,
  checkVoterStatus,
  getVoterDetails,
  setRegistrationStatus
} = require("../utils/blockchain");
const { ethers } = require("ethers");

// Middleware to check if the request comes from an admin
const isAdmin = async (req, res, next) => {
  try {
    const adminAddress = process.env.ADMIN_ADDRESS;
    if (!adminAddress) {
      return res.status(500).json({ error: "Admin address not configured" });
    }

    const providedAdmin = req.headers['x-admin-address'] || req.query.adminAddress || req.body.adminAddress;

    // Check if the sender address matches the admin address
    if (providedAdmin && providedAdmin.toLowerCase() === adminAddress.toLowerCase()) {
      next();
    } else {
      return res.status(403).json({ error: "Unauthorized access" });
    }
  } catch (error) {
    console.error("Admin check error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Register a new voter
router.post("/register", async (req, res) => {
  try {
    const { address, name, dob, voterIdHash, aadharNumber, residentialAddress } = req.body;

    // Validate inputs
    if (!address || !name || !dob || !voterIdHash || !aadharNumber || !residentialAddress) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Validate address format
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
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
    const tx = await registerVoter(address, name, dobTimestamp, voterIdHash, aadharNumber, residentialAddress);

    res.status(201).json({
      message: "Voter registered successfully",
      transactionHash: tx.hash,
      blockNumber: tx.blockNumber
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Handle specific blockchain errors
    if (error.message && error.message.includes("Already registered")) {
      return res.status(409).json({ error: "Voter already registered" });
    }

    if (error.message && error.message.includes("registration is currently closed")) {
      return res.status(403).json({ error: "Voter registration is currently closed" });
    }

    if (error.message && error.message.includes("Aadhar number already registered")) {
      return res.status(409).json({ error: "Aadhar number already registered" });
    }

    if (error.message && error.message.includes("Voter ID already registered")) {
      return res.status(409).json({ error: "Voter ID already registered" });
    }

    res.status(500).json({ error: "Registration failed", details: error.message });
  }
});

// Verify a voter (admin only)
router.post("/verify", isAdmin, async (req, res) => {
  try {
    const { voterAddress } = req.body;

    // Validate address format
    if (!voterAddress || !ethers.isAddress(voterAddress)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    // Call blockchain function to verify voter
    const tx = await verifyVoter(voterAddress);

    res.json({
      message: "Voter verified successfully",
      transactionHash: tx.hash,
      blockNumber: tx.blockNumber
    });
  } catch (error) {
    console.error("Verification error:", error);

    // Handle specific blockchain errors
    if (error.message && error.message.includes("Voter not registered")) {
      return res.status(404).json({ error: "Voter not registered" });
    }

    if (error.message && error.message.includes("Voter already verified")) {
      return res.status(409).json({ error: "Voter already verified" });
    }

    res.status(500).json({ error: "Verification failed", details: error.message });
  }
});

// Check voter status
router.get("/status/:address", async (req, res) => {
  try {
    const { address } = req.params;

    // Validate address format
    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    // Call blockchain function to check voter status
    const isVerified = await checkVoterStatus(address);

    res.json({ address, isVerified });
  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({ error: "Status check failed", details: error.message });
  }
});

// Get voter details
router.get("/details/:address", async (req, res) => {
  try {
    const { address } = req.params;

    // Validate address format
    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    // Call blockchain function to get voter details
    const details = await getVoterDetails(address);

    // Format timestamps as ISO dates
    const formattedDetails = {
      ...details,
      dob: new Date(details.dob * 1000).toISOString().split('T')[0],
      registrationDate: new Date(details.registrationTimestamp * 1000).toISOString(),
      lastVerifiedDate: details.lastVerifiedTimestamp ?
        new Date(details.lastVerifiedTimestamp * 1000).toISOString() : null
    };

    res.json({ address, details: formattedDetails });
  } catch (error) {
    console.error("Details fetch error:", error);
    res.status(500).json({ error: "Failed to fetch voter details", details: error.message });
  }
});

// Set registration status (admin only)
router.post("/registration-status", isAdmin, async (req, res) => {
  try {
    const { isOpen } = req.body;

    if (typeof isOpen !== 'boolean') {
      return res.status(400).json({ error: "isOpen parameter must be a boolean" });
    }

    // Call blockchain function to set registration status
    const tx = await setRegistrationStatus(isOpen);

    res.json({
      message: `Voter registration is now ${isOpen ? 'open' : 'closed'}`,
      transactionHash: tx.hash,
      blockNumber: tx.blockNumber
    });
  } catch (error) {
    console.error("Registration status update error:", error);
    res.status(500).json({ error: "Failed to update registration status", details: error.message });
  }
});

// Add health check endpoint
router.get('/health', async (req, res) => {
  try {
    res.status(200).json({
      status: 'OK',
      service: 'blockchain',
      contractAddress: process.env.CONTRACT_ADDRESS || 'Not configured'
    });
  } catch (error) {
    res.status(500).json({ status: 'Error', error: error.message });
  }
});

module.exports = router;