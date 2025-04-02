const mongoose = require('mongoose');

const VoterSchema = new mongoose.Schema({
  blockchainAddress: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  dob: {
    type: Date,
    required: true
  },
  aadharNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  voterIdHash: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  residentialAddress: {
    type: String,
    required: true,
    trim: true
  },
  district: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  pincode: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
    default: 'Prefer not to say'
  },
  contactPhone: {
    type: String,
    trim: true
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  verificationDate: {
    type: Date
  },
  profilePhotoUrl: {
    type: String,
    trim: true
  },
  transactionHash: {
    type: String,
    trim: true
  },
  blockNumber: {
    type: Number
  }
}, {
  timestamps: true
});

// Create index for faster queries
VoterSchema.index({ blockchainAddress: 1 });
VoterSchema.index({ aadharNumber: 1 });
VoterSchema.index({ voterIdHash: 1 });
VoterSchema.index({ isVerified: 1 });

module.exports = mongoose.model('Voter', VoterSchema); 