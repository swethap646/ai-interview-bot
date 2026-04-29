const mongoose = require('mongoose');

/**
 * connectDB
 * Connects to MongoDB using the DATABASE_URL in the .env file.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.DATABASE_URL);

    console.log(`✅ MongoDB Connected: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    return null;
  }
};

module.exports = connectDB;
