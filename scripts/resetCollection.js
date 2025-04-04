const mongoose = require('mongoose');
require('dotenv').config();

async function resetVotersCollection() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Get reference to the voters collection
    const db = mongoose.connection.db;
    const voterCollection = db.collection('voters');
    
    // List all indexes
    console.log('Current indexes:');
    const indexes = await voterCollection.indexes();
    console.log(indexes);
    
    // Drop the problematic aadharHash index if it exists
    const aadharHashIndex = indexes.find(index => 
      index.name === 'aadharHash_1' || 
      index.name.includes('aadharHash'));
    
    if (aadharHashIndex) {
      console.log('Dropping problematic index:', aadharHashIndex.name);
      await voterCollection.dropIndex(aadharHashIndex.name);
      console.log('Index dropped successfully');
    } else {
      console.log('No aadharHash index found');
    }
    
    // Optionally drop the entire collection to start fresh
    // Uncomment the next lines if you want to drop the entire collection
    console.log('Dropping voters collection...');
    await voterCollection.drop();
    console.log('Voters collection dropped successfully');
    
    console.log('Done! The application will now use the updated schema.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
resetVotersCollection()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  }); 