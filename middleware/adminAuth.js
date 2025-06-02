const { ethers } = require('ethers');

// Admin authentication middleware
const adminAuth = async (req, res, next) => {
    try {
        // Get admin address from headers
        const adminAddress = req.headers['x-admin-address'];

        if (!adminAddress) {
            return res.status(401).json({
                error: 'Unauthorized access',
                message: 'Admin address required in x-admin-address header'
            });
        }

        // Validate address format
        if (!ethers.isAddress(adminAddress)) {
            return res.status(401).json({
                error: 'Unauthorized access',
                message: 'Invalid admin address format'
            });
        }

        // Use hardcoded admin address from environment
        const authorizedAdmin = process.env.ADMIN_ADDRESS;

        // Check if provided address matches authorized admin
        if (adminAddress.toLowerCase() !== authorizedAdmin.toLowerCase()) {
            return res.status(403).json({
                error: 'Unauthorized access',
                message: 'Address is not authorized as admin'
            });
        }

        // Add admin address to request for later use
        req.adminAddress = adminAddress;
        next();

    } catch (error) {
        console.error('Admin authentication error:', error);
        res.status(500).json({
            error: 'Authentication failed',
            message: 'Unable to verify admin status'
        });
    }
};

module.exports = adminAuth;
