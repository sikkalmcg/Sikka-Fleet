const mongoose = require('mongoose');

const connectDB = async () => {
  // Reuse existing connection if available (for serverless environments like Vercel)
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  const primaryURI = process.env.MONGODB_URI || process.env.MONGO_URI;
  const localURI = 'mongodb://127.0.0.1:27017/sikka_fleet';
  const dbName = process.env.MONGODB_DB_NAME || 'sikka_fleet';

  // 1. Try Primary MongoDB URI (e.g. MongoDB Atlas)
  if (primaryURI && !primaryURI.includes('127.0.0.1') && !primaryURI.includes('localhost')) {
    try {
      console.log(`[Database] Attempting connection to MongoDB Atlas...`);
      const conn = await mongoose.connect(primaryURI, {
        dbName,
        autoIndex: true,
        serverSelectionTimeoutMS: 4000,
      });
      console.log(`[Database] MongoDB Atlas Connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (err) {
      console.warn(`[Database Warning] Atlas connection failed (${err.message}).`);
      console.warn(`[Database Warning] Falling back to local MongoDB instance: ${localURI}`);
    }
  }

  // 2. Fallback to Local MongoDB
  try {
    const conn = await mongoose.connect(localURI, {
      dbName,
      autoIndex: true,
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`[Database] Local MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error(`[Database Error] Could not connect to either Atlas or Local MongoDB: ${err.message}`);
  }
};

module.exports = connectDB;
