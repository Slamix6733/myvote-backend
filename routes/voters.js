const express = require('express');
const router = express.Router();
const { 
  registerVoter, 
  verifyVoter, 
  checkVoterStatus, 
  getVoterDetails,
  updateVoterProfile 
} = require('../controllers/voterController');

// Register a new voter
router.post('/register', registerVoter);

// Verify a voter (admin only)
router.post('/verify', verifyVoter);

// Check voter status
router.get('/status/:address', checkVoterStatus);

// Get voter details
router.get('/details/:address', getVoterDetails);

// Update voter profile (only extended fields)
router.patch('/profile/:address', updateVoterProfile);

module.exports = router; 