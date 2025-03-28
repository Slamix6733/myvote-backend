const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { initProvider, initContract } = require("./utils/blockchain");
const blockchainRoutes = require("./routes/blockchain");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json()); // Parse JSON request body
app.use(cors()); // Enable CORS

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

// Test route
app.get("/", (req, res) => {
  res.send("Voter Identification Portal Backend is running!");
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
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
  console.log(`Blockchain API available at http://localhost:${PORT}/api/blockchain`);
});
