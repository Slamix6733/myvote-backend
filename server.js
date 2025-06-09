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
console.log('Starting route loading...');
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

// Check if routes directory exists
const fs = require('fs');
const routesPath = path.join(__dirname, 'routes');
console.log('Routes path:', routesPath);
console.log('Routes directory exists:', fs.existsSync(routesPath));

if (fs.existsSync(routesPath)) {
    console.log('Files in routes directory:', fs.readdirSync(routesPath));
}

const routes = [
    { path: '/api/voters', file: './routes/voters', name: 'voters' },
    { path: '/api/upload', file: './routes/upload', name: 'upload' },
    { path: '/api/blockchain', file: './routes/blockchain', name: 'blockchain' },
    { path: '/api/admin', file: './routes/admin', name: 'admin' },
    { path: '/api/health', file: './routes/health', name: 'health' },
    { path: '/api/qrcode', file: './routes/qrcode', name: 'qrcode' } // Add this line
];

let loadedRoutes = 0;

routes.forEach(route => {
    try {
        console.log(`Attempting to load ${route.name} from ${route.file}...`);

        // Check if file exists before requiring
        const fullPath = path.join(__dirname, route.file.replace('./', ''));
        console.log(`Full path: ${fullPath}.js`);
        console.log(`File exists: ${fs.existsSync(fullPath + '.js')}`);

        const routeHandler = require(route.file);
        app.use(route.path, routeHandler);
        console.log(`✓ ${route.name} routes loaded successfully`);
        loadedRoutes++;
    } catch (error) {
        console.error(`✗ Failed to load ${route.name} routes:`, error.message);
        console.error('Error code:', error.code);
        console.error('Stack trace:', error.stack);

        // Create a detailed fallback route
        app.use(route.path, (req, res) => {
            res.status(500).json({
                error: `${route.name} route failed to load`,
                message: error.message,
                code: error.code,
                filePath: route.file,
                timestamp: new Date().toISOString(),
                debugInfo: {
                    cwd: process.cwd(),
                    dirname: __dirname,
                    routesExists: fs.existsSync(routesPath)
                }
            });
        });
    }
});

console.log(`Route loading complete. ${loadedRoutes}/${routes.length} routes loaded successfully.`);

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
