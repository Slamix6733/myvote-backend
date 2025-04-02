const mongoose = require('mongoose');

const SystemStatsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  totalRegisteredVoters: {
    type: Number,
    default: 0
  },
  totalVerifiedVoters: {
    type: Number,
    default: 0
  },
  dailyRegistrations: {
    type: Number,
    default: 0
  },
  dailyVerifications: {
    type: Number,
    default: 0
  },
  pendingVerifications: {
    type: Number,
    default: 0
  },
  maleVoters: {
    type: Number,
    default: 0
  },
  femaleVoters: {
    type: Number,
    default: 0
  },
  otherGenderVoters: {
    type: Number,
    default: 0
  },
  ageDistribution: {
    below18: {
      type: Number,
      default: 0
    },
    age18to25: {
      type: Number,
      default: 0
    },
    age26to35: {
      type: Number,
      default: 0
    },
    age36to45: {
      type: Number,
      default: 0
    },
    age46to60: {
      type: Number,
      default: 0
    },
    above60: {
      type: Number,
      default: 0
    }
  },
  stateWiseDistribution: {
    type: Map,
    of: Number,
    default: {}
  },
  registrationSuccess: {
    type: Number,
    default: 0
  },
  registrationFailure: {
    type: Number,
    default: 0
  },
  verificationSuccess: {
    type: Number,
    default: 0
  },
  verificationFailure: {
    type: Number,
    default: 0
  },
  totalTransactions: {
    type: Number,
    default: 0
  },
  gasUsed: {
    type: Number,
    default: 0
  },
  averageResponseTime: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Create index for faster queries
SystemStatsSchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('SystemStats', SystemStatsSchema); 