const Voter = require('../models/Voter');
const AdminLog = require('../models/AdminLog');
const SystemStats = require('../models/SystemStats');
const { ethers } = require('ethers');

// Helper function to get age from DOB
const getAge = (dob) => {
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Helper function to categorize age
const categorizeAge = (age) => {
  if (age < 18) return 'below18';
  if (age <= 25) return 'age18to25';
  if (age <= 35) return 'age26to35';
  if (age <= 45) return 'age36to45';
  if (age <= 60) return 'age46to60';
  return 'above60';
};

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Get today's date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get yesterday's date
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Get last 7 days
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);
    
    // Get last 30 days
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);
    
    // Get counts
    const totalVoters = await Voter.countDocuments();
    const verifiedVoters = await Voter.countDocuments({ isVerified: true });
    const pendingVerification = await Voter.countDocuments({ isVerified: false });
    
    // Get today's registrations
    const todayRegistrations = await Voter.countDocuments({
      registrationDate: { $gte: today }
    });
    
    // Get today's verifications
    const todayVerifications = await Voter.countDocuments({
      verificationDate: { $gte: today }
    });
    
    // Get gender distribution
    const maleVoters = await Voter.countDocuments({ gender: 'Male' });
    const femaleVoters = await Voter.countDocuments({ gender: 'Female' });
    const otherGenderVoters = await Voter.countDocuments({ 
      gender: { $nin: ['Male', 'Female'] }
    });
    
    // Get registration trends (last 7 days)
    const last7DaysRegistrations = await Voter.aggregate([
      { 
        $match: { 
          registrationDate: { $gte: last7Days } 
        } 
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$registrationDate" } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get verification trends (last 7 days)
    const last7DaysVerifications = await Voter.aggregate([
      { 
        $match: { 
          verificationDate: { $gte: last7Days, $ne: null } 
        } 
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$verificationDate" } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get state distribution
    const stateDistribution = await Voter.aggregate([
      { 
        $match: { 
          state: { $ne: null, $ne: "" } 
        } 
      },
      {
        $group: {
          _id: "$state",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get admin activity (recent 10)
    const recentAdminActivity = await AdminLog.find()
      .sort({ timestamp: -1 })
      .limit(10);
    
    // Calculate age distribution
    const voters = await Voter.find({}, { dob: 1 });
    const ageDistribution = {
      below18: 0,
      age18to25: 0,
      age26to35: 0,
      age36to45: 0,
      age46to60: 0,
      above60: 0
    };
    
    voters.forEach(voter => {
      if (voter.dob) {
        const age = getAge(voter.dob);
        const category = categorizeAge(age);
        ageDistribution[category]++;
      }
    });
    
    // Save system stats for today
    let systemStats = await SystemStats.findOne({ 
      date: { 
        $gte: today, 
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) 
      } 
    });
    
    if (!systemStats) {
      systemStats = new SystemStats({
        date: today,
        totalRegisteredVoters: totalVoters,
        totalVerifiedVoters: verifiedVoters,
        dailyRegistrations: todayRegistrations,
        dailyVerifications: todayVerifications,
        pendingVerifications: pendingVerification,
        maleVoters,
        femaleVoters,
        otherGenderVoters,
        ageDistribution
      });
      
      // Convert state distribution to Map
      const stateWiseDistribution = new Map();
      stateDistribution.forEach(item => {
        stateWiseDistribution.set(item._id, item.count);
      });
      
      systemStats.stateWiseDistribution = stateWiseDistribution;
      await systemStats.save();
    }
    
    res.json({
      totalVoters,
      verifiedVoters,
      pendingVerification,
      verificationRate: totalVoters > 0 ? (verifiedVoters / totalVoters * 100).toFixed(2) : 0,
      todayRegistrations,
      todayVerifications,
      genderDistribution: {
        male: maleVoters,
        female: femaleVoters,
        other: otherGenderVoters
      },
      registrationTrends: last7DaysRegistrations,
      verificationTrends: last7DaysVerifications,
      stateDistribution,
      ageDistribution,
      recentAdminActivity
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ error: 'Failed to get dashboard statistics', details: error.message });
  }
};

// Get all voters with pagination and filters
const getAllVoters = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filters
    const filter = {};
    
    if (req.query.isVerified) {
      filter.isVerified = req.query.isVerified === 'true';
    }
    
    if (req.query.search) {
      const search = req.query.search;
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { blockchainAddress: { $regex: search, $options: 'i' } },
        { aadharNumber: { $regex: search, $options: 'i' } },
        { voterIdHash: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (req.query.state) {
      filter.state = req.query.state;
    }
    
    // Get total count for pagination
    const total = await Voter.countDocuments(filter);
    
    // Get voters
    const voters = await Voter.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.json({
      voters,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting voters:', error);
    res.status(500).json({ error: 'Failed to get voters', details: error.message });
  }
};

// Get admin logs with pagination and filters
const getAdminLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Filters
    const filter = {};
    
    if (req.query.adminAddress) {
      filter.adminAddress = req.query.adminAddress;
    }
    
    if (req.query.action) {
      filter.action = req.query.action;
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.fromDate && req.query.toDate) {
      filter.timestamp = {
        $gte: new Date(req.query.fromDate),
        $lte: new Date(req.query.toDate)
      };
    }
    
    // Get total count for pagination
    const total = await AdminLog.countDocuments(filter);
    
    // Get logs
    const logs = await AdminLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    res.json({
      logs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting admin logs:', error);
    res.status(500).json({ error: 'Failed to get admin logs', details: error.message });
  }
};

// Get voter details by address
const getVoterByAddress = async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate address format
    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }
    
    // Find voter in MongoDB
    const voter = await Voter.findOne({ blockchainAddress: address });
    
    if (!voter) {
      return res.status(404).json({ error: "Voter not found" });
    }
    
    res.json({ voter });
  } catch (error) {
    console.error('Error getting voter details:', error);
    res.status(500).json({ error: 'Failed to get voter details', details: error.message });
  }
};

// Log admin activity
const logAdminActivity = async (adminAddress, action, description, targetAddress = null, transactionHash = null, status = 'SUCCESS', metadata = {}, ipAddress = null) => {
  try {
    const log = new AdminLog({
      adminAddress,
      action,
      description,
      targetAddress,
      transactionHash,
      status,
      metadata,
      ipAddress
    });
    
    await log.save();
    return log;
  } catch (error) {
    console.error('Error logging admin activity:', error);
    throw error;
  }
};

// Get historical stats (time series data)
const getHistoricalStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Get start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);
    
    // Get stats
    const stats = await SystemStats.find({
      date: { $gte: startDate }
    }).sort({ date: 1 });
    
    res.json({ stats });
  } catch (error) {
    console.error('Error getting historical stats:', error);
    res.status(500).json({ error: 'Failed to get historical statistics', details: error.message });
  }
};

// Get state-wise voter distribution
const getStateDistribution = async (req, res) => {
  try {
    const stateDistribution = await Voter.aggregate([
      { 
        $match: { 
          state: { $ne: null, $ne: "" } 
        } 
      },
      {
        $group: {
          _id: "$state",
          total: { $sum: 1 },
          verified: { 
            $sum: { 
              $cond: [{ $eq: ["$isVerified", true] }, 1, 0] 
            } 
          },
          unverified: { 
            $sum: { 
              $cond: [{ $eq: ["$isVerified", false] }, 1, 0] 
            } 
          }
        }
      },
      { $sort: { total: -1 } }
    ]);
    
    res.json({ stateDistribution });
  } catch (error) {
    console.error('Error getting state distribution:', error);
    res.status(500).json({ error: 'Failed to get state distribution', details: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getAllVoters,
  getAdminLogs,
  getVoterByAddress,
  logAdminActivity,
  getHistoricalStats,
  getStateDistribution
}; 