const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllVoters,
  getAdminLogs,
  getVoterByAddress,
  getHistoricalStats,
  getStateDistribution
} = require('../controllers/adminController');

// Middleware to check if the request comes from an admin
const isAdmin = async (req, res, next) => {
  try {
    const adminAddress = process.env.ADMIN_ADDRESS;
    if (!adminAddress) {
      return res.status(500).json({ error: "Admin address not configured" });
    }

    const providedAdmin = req.headers['x-admin-address'] || req.query.adminAddress;

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

// Dashboard statistics
router.get('/stats', isAdmin, getDashboardStats);

// Add health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'admin' });
});

// Get all voters with pagination
router.get('/voters', isAdmin, getAllVoters);

// Get specific voter by address
router.get('/voters/:address', isAdmin, getVoterByAddress);

// Get admin activity logs
router.get('/logs', isAdmin, getAdminLogs);

// Get historical statistics
router.get('/stats/historical', isAdmin, getHistoricalStats);

// Get state-wise distribution
router.get('/stats/states', isAdmin, getStateDistribution);

module.exports = router;