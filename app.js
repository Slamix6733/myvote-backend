const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/database');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (for uploaded images)
app.use('/uploads', express.static('uploads'));

// Import routes
const voterRoutes = require('./routes/voters');
const adminRoutes = require('./routes/admin');
const blockchainRoutes = require('./routes/blockchain');
const uploadRoutes = require('./routes/upload');

// Use routes
app.use('/api/voters', voterRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/voting', require('./routes/voting'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            blockchain: true,
            database: true
        }
    });
});

// Default route
app.get('/', (req, res) => {
    res.json({
        message: 'Voter Identification Portal API',
        version: '1.0.0',
        endpoints: {
            voters: '/api/voters',
            admin: '/api/admin',
            blockchain: '/api/blockchain',
            upload: '/api/upload',
            health: '/health'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.originalUrl}`
    });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}`);
    console.log(`💊 Health check at http://localhost:${PORT}/health`);
});

module.exports = app;