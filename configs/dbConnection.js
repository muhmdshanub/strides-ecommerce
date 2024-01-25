const mongoose = require('mongoose');

const atlasConnectionString = process.env.DB_URL;


async function connectToDatabase() {
  try {

    

    await mongoose.connect(atlasConnectionString);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
}

module.exports = { connectToDatabase };