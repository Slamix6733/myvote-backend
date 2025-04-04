const mongoose = require('mongoose');
require('dotenv').config();
const Voter = require('../models/Voter');

async function testMongoSave() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Create a simple test voter
    const testVoter = new Voter({
      blockchainAddress: '0x' + Math.random().toString(16).substring(2, 42),
      encryptedData: {
        data: 'test-encrypted-data',
        iv: 'test-iv'
      },
      rawData: {
        name: 'Test User',
        aadharNumber: '123' + Math.floor(Math.random() * 1000000000)
      },
      district: 'Test District',
      gender: 'Other',
      dob: new Date('2000-01-01')
    });
    
    // Save the test voter
    console.log('Attempting to save test voter');
    const savedVoter = await testVoter.save();
    console.log('Test voter saved successfully:', savedVoter._id);
    
    // Get a count of all voters
    const count = await Voter.countDocuments();
    console.log(`Total voters in database: ${count}`);
    
    // List all voters
    const allVoters = await Voter.find().limit(5);
    console.log('Sample voters:', allVoters.map(v => ({
      id: v._id,
      address: v.blockchainAddress,
      name: v.rawData?.name,
      aadhar: v.rawData?.aadharNumber?.substring(0, 4) + '****'
    })));
    
    console.log('MongoDB test completed successfully');
  } catch (error) {
    console.error('Error during MongoDB test:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
testMongoSave()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  }); 