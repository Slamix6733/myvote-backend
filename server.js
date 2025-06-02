const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080; // Changed for App Engine compatibility

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint (before other routes)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        service: 'myvote-backend',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        env: {
            port: PORT,
            nodeEnv: process.env.NODE_ENV,
            hasMongoUri: !!process.env.MONGODB_URI,
            hasAdminAddress: !!process.env.ADMIN_ADDRESS,
            hasContractAddress: !!process.env.CONTRACT_ADDRESS
        }
    });
});

// API health check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        service: 'myvote-api',
        timestamp: new Date().toISOString()
    });
});

// Database connection
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
        .then(() => {
            console.log('Connected to MongoDB successfully');
        })
        .catch((error) => {
            console.error('MongoDB connection error:', error);
        });
} else {
    console.warn('MONGODB_URI not provided, running without database');
}

// Import routes
try {
    const voterRoutes = require('./routes/voters');
    const uploadRoutes = require('./routes/upload');
    const blockchainRoutes = require('./routes/blockchain');
    const adminRoutes = require('./routes/admin');

    // Use routes
    app.use('/api/voters', voterRoutes);
    app.use('/api/upload', uploadRoutes);
    app.use('/api/blockchain', blockchainRoutes);
    app.use('/api/admin', adminRoutes);
} catch (error) {
    console.error('Error loading routes:', error);
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});

module.exports = app;
