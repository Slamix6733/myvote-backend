const express = require('express');
const router = express.Router();
const {
  registerVoter,
  verifyVoter,
  checkVoterStatus,
  getVoterDetails,
  getVoterByAdmin
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

module.exports = router;