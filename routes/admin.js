const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const {
  getDashboardStats,
  getAllVoters,
  getAdminLogs,
  getVoterByAddress,
  getHistoricalStats,
  getStateDistribution
} = require('../controllers/adminController');

// Apply admin authentication to all routes
router.use(adminAuth);

// Dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await getDashboardStats();

    res.json({
      totalVoters: stats.totalVoters || 0,
      verifiedVoters: stats.verifiedVoters || 0,
      pendingVerification: stats.pendingVerification || 0,
      // ...existing response data...
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      details: error.message
    });
  }
});

// Add health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'admin' });
});

// Get all voters with pagination
router.get('/voters', getAllVoters);

// Get specific voter by address
router.get('/voters/:address', getVoterByAddress);

// Get admin activity logs
router.get('/logs', getAdminLogs);

// Get historical statistics
router.get('/stats/historical', getHistoricalStats);

// Get state-wise distribution
router.get('/stats/states', getStateDistribution);

module.exports = router;