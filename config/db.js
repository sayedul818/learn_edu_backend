const mongoose = require('mongoose');

let cached = global.__mongooseConnectionCache;
if (!cached) {
  cached = global.__mongooseConnectionCache = { conn: null, promise: null };
}

const connectDB = async () => {
  try {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
      cached.promise = mongoose.connect(process.env.MONGODB_URI).then((mongooseInstance) => {
        console.log(`✓ MongoDB Connected: ${mongooseInstance.connection.host}`);
        return mongooseInstance;
      });
    }

    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    console.error(`✗ Error connecting to MongoDB: ${error.message}`);
    cached.promise = null;
    throw error;
  }
};

module.exports = connectDB;
