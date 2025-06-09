const mongoose = require('mongoose');

// Schema options
const schemaOptions = {
  timestamps: true,
  autoIndex: false  // Disable automatic indexing
};

const VoterSchema = new mongoose.Schema({
  blockchainAddress: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // Encrypted fields with personal information
  encryptedData: {
    type: Object,
    required: true
  },
  // Raw data (temporary, for debugging purposes)
  rawData: {
    name: String,
    aadharNumber: String  // No unique constraint here, we'll use manual indexing
  },
  // Blockchain-related data (will be used later)
  blockchain: {
    nameHash: String,
    aadharHash: String,  // No unique constraint here
    txHash: String,
    registrationTimestamp: Number,
    verificationTxHash: String,
    lastVerifiedTimestamp: Number
  },
  // Basic profile info (not sensitive)
  district: {
    type: String
  },
  gender: {
    type: String
  },
  dob: {
    type: Date
  },
  // Document information
  aadharImage: {
    type: String
  },
  // Status information
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationDate: {
    type: Date
  },
  // Additional metadata
  verificationNotes: {
    type: String
  },
  verifiedBy: {
    type: String
  },
  // Add QR code fields
  qrCode: {
    nameHash: String,
    aadharHash: String,
    txHash: String,
    firebaseUrl: String,
    fileName: String,
    generatedAt: Date,
    expiresAt: Date,  // Add expiration time
    isActive: {       // Add active status
      type: Boolean,
      default: true
    }
  },
  // Add voting status
  isVoted: {
    type: Boolean,
    default: false
  },
  votingDate: {
    type: Date
  }
}, schemaOptions);

// Manually create indexes for faster queries and uniqueness constraints
VoterSchema.index({ blockchainAddress: 1 }, { unique: true });
VoterSchema.index({ 'rawData.aadharNumber': 1 }, { unique: true, sparse: true });
VoterSchema.index({ isVerified: 1 });
VoterSchema.index({ 'qrCode.aadharHash': 1 }, { sparse: true });
// Add index for voting status
VoterSchema.index({ isVoted: 1 });
VoterSchema.index({ 'qrCode.expiresAt': 1 });

module.exports = mongoose.model('Voter', VoterSchema);