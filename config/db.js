import mongoose from 'mongoose';
import { config } from './index.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongodb.uri, {
      dbName: config.mongodb.dbName,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
