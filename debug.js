const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Basic health check that doesn't rely on blockchain
app.get('/api/health', (req, res) => {
    try {
        res.status(200).json({
            status: 'ok',
            message: 'Server is running',
            environment: process.env.NODE_ENV,
            contractConfigured: !!process.env.CONTRACT_ADDRESS,
            contractAddress: process.env.CONTRACT_ADDRESS,
            time: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            stack: process.env.NODE_ENV === 'production' ? '(hidden)' : error.stack
        });
    }
});

// Configuration check endpoint
app.get('/api/config', (req, res) => {
    res.status(200).json({
        nodeEnv: process.env.NODE_ENV,
        contractAddress: process.env.CONTRACT_ADDRESS ?
            `${process.env.CONTRACT_ADDRESS.substring(0, 6)}...${process.env.CONTRACT_ADDRESS.substring(38)}` :
            'Not configured',
        rpcConfigured: !!process.env.SEPOLIA_RPC_URL,
        adminConfigured: !!process.env.ADMIN_ADDRESS
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Debug server running on port ${PORT}`);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Contract configured:', !!process.env.CONTRACT_ADDRESS);
});