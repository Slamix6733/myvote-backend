const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const { initProvider, initContract } = require("./utils/blockchain");
const connectDB = require("./config/db");
const blockchainRoutes = require("./routes/blockchain");
const adminRoutes = require("./routes/admin");
const voterRoutes = require("./routes/voters");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json()); // Parse JSON request body
app.use(cors()); // Enable CORS

// Connect to MongoDB
connectDB()
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
  });

// Initialize blockchain connection
try {
  initProvider();
  initContract();
  console.log("Blockchain connection initialized");
} catch (error) {
  console.error("Error initializing blockchain connection:", error.message);
}

// Routes
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/voters", voterRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Voter Identification Portal Backend is running!");
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    services: {
      blockchain: true,
      database: !!mongoose.connection.readyState
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: "Internal Server Error", 
    message: process.env.NODE_ENV === "development" ? err.message : undefined 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin dashboard API available at http://localhost:${PORT}/api/admin`);
  console.log(`Voter API available at http://localhost:${PORT}/api/voters`);
  console.log(`Blockchain API available at http://localhost:${PORT}/api/blockchain`);
});
