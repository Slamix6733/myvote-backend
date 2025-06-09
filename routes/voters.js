const express = require('express');
const router = express.Router();
const {
  registerVoter,
  verifyVoter,
  checkVoterStatus,
  getVoterDetails,
  getVoterByAdmin,
  // Add new wallet abstraction functions
  registerVoterWithAadhar,
  getVoterByAadhar,
  checkStatusByAadhar,
  verifyVoterByAadhar,  // Add this new function
  generateVotingQR, // Import the QR code generation function
  processVoteViaScan // Import the vote processing function
} = require('../controllers/voterController');

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

// ========== EXISTING ROUTES (Wallet-based) ==========
// Register a new voter
router.post('/register', registerVoter);

// Verify a voter (admin only)
router.post('/verify', verifyVoter);

// Check voter status
router.get('/status/:address', checkVoterStatus);

// Get voter details (limited for regular users, full for admin or self)
router.get('/details/:address', getVoterDetails);

// Admin access to voter details with decrypted data
router.get('/admin/:address', isAdmin, getVoterByAdmin);

// ========== NEW WALLET ABSTRACTION ROUTES ==========
// Register voter with just Aadhar number (no wallet needed)
router.post('/register-aadhar', registerVoterWithAadhar);

// Get voter details by Aadhar number
router.get('/lookup/:aadharNumber', getVoterByAadhar);

// Check voter registration status by Aadhar number
router.get('/status/aadhar/:aadharNumber', checkStatusByAadhar);

// Admin verify voter by Aadhar number
router.post('/verify-aadhar/:aadharNumber', isAdmin, verifyVoterByAadhar);

// Admin access to voter details by Aadhar number with decrypted data
router.get('/admin/aadhar/:aadharNumber', isAdmin, async (req, res) => {
  try {
    const { aadharNumber } = req.params;
    const adminAddress = req.headers['x-admin-address'] || req.query.adminAddress;

    // Find voter by Aadhar
    const Voter = require('../models/Voter');
    const { decryptSensitiveData } = require('../utils/crypto');

    const voter = await Voter.findOne({ 'rawData.aadharNumber': aadharNumber });

    if (!voter) {
      return res.status(404).json({ error: "Voter not found" });
    }

    // Decrypt sensitive data for admin
    const decryptedData = decryptSensitiveData(voter.encryptedData);

    // Format response
    const response = {
      blockchainAddress: voter.blockchainAddress,
      aadharNumber: aadharNumber,
      profile: decryptedData,
      isVerified: voter.isVerified,
      registrationDate: voter.createdAt,
      verificationDate: voter.verificationDate,
      district: voter.district,
      gender: voter.gender,
      aadharImage: voter.aadharImage,
      verificationNotes: voter.verificationNotes,
      verifiedBy: voter.verifiedBy,
      registrationMethod: 'aadhar'
    };

    res.json(response);
  } catch (error) {
    console.error("Admin Aadhar voter fetch error:", error);
    res.status(500).json({ error: "Failed to fetch voter data", details: error.message });
  }
});

// Generate voting QR code for verified voter
router.post('/generate-voting-qr/:aadharNumber', isAdmin, generateVotingQR);

// Process vote via QR scan
router.post('/vote-via-scan', processVoteViaScan);

// Get voting statistics
router.get('/admin/voting-stats', isAdmin, async (req, res) => {
  try {
    const Voter = require('../models/Voter');

    const totalVerified = await Voter.countDocuments({ isVerified: true });
    const totalVoted = await Voter.countDocuments({ isVoted: true });
    const pendingVotes = totalVerified - totalVoted;

    res.json({
      totalVerified,
      totalVoted,
      pendingVotes,
      turnoutPercentage: totalVerified > 0 ? ((totalVoted / totalVerified) * 100).toFixed(2) : 0
    });

  } catch (error) {
    console.error("Voting stats error:", error);
    res.status(500).json({ error: "Failed to fetch voting statistics" });
  }
});

// Bulk operations for admin
router.get('/admin/stats/summary', isAdmin, async (req, res) => {
  try {
    const Voter = require('../models/Voter');

    const totalVoters = await Voter.countDocuments();
    const verifiedVoters = await Voter.countDocuments({ isVerified: true });
    const pendingVoters = await Voter.countDocuments({ isVerified: false });

    // Count by registration method
    const walletBasedVoters = await Voter.countDocuments({
      'encryptedData.walletAbstraction': { $exists: false }
    });
    const aadharBasedVoters = await Voter.countDocuments({
      'encryptedData.walletAbstraction': { $exists: true }
    });

    res.json({
      totalVoters,
      verifiedVoters,
      pendingVoters,
      registrationMethods: {
        walletBased: walletBasedVoters,
        aadharBased: aadharBasedVoters
      },
      verificationRate: totalVoters > 0 ? (verifiedVoters / totalVoters * 100).toFixed(2) : 0
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

module.exports = router;