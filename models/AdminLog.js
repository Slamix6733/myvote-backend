const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
  adminAddress: {
    type: String,
    required: true,
    trim: true
  },
  action: {
    type: String,
    required: true,
    enum: ['VERIFY_VOTER', 'REJECT_VOTER', 'CHANGE_REGISTRATION_STATUS', 'OTHER'],
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  targetAddress: {
    type: String,
    trim: true
  },
  transactionHash: {
    type: String,
    trim: true
  },
  ipAddress: {
    type: String,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILURE', 'PENDING'],
    default: 'SUCCESS'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Create index for faster queries
AdminLogSchema.index({ adminAddress: 1 });
AdminLogSchema.index({ action: 1 });
AdminLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AdminLog', AdminLogSchema); 