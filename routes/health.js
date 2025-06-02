const express = require('express');
const router = express.Router();
const { getHealthStatus } = require('../controllers/adminController');

// Main health check endpoint
router.get('/', async (req, res) => {
    try {
        res.status(200).json({
            status: 'OK',
            service: 'myvote-backend',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    } catch (error) {
        res.status(500).json({
            status: 'Error',
            error: error.message
        });
    }
});

// Detailed health check with database
router.get('/detailed', getHealthStatus);

module.exports = router;
