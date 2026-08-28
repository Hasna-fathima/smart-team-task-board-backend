import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoMemoryServer: MongoMemoryServer | null = null;

export const connectDB = async () => {
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      'mongodb://127.0.0.1:27017/smart_task_board';

    if (process.env.NODE_ENV === 'test') {
      mongoMemoryServer = await MongoMemoryServer.create();
      const memoryUri = mongoMemoryServer.getUri();
      const conn = await mongoose.connect(memoryUri);
      return conn;
    }

    try {
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 2500,
      });
      console.log(`[MongoDB Connected]: ${conn.connection.host}`);
      return conn;
    } catch (primaryErr) {
      console.warn(
        `[MongoDB Warning]: Primary connection to ${mongoUri} failed. Spinning up in-memory MongoDB...`
      );
      mongoMemoryServer = await MongoMemoryServer.create();
      const memoryUri = mongoMemoryServer.getUri();
      const conn = await mongoose.connect(memoryUri);
      console.log(`[MongoDB Memory Server Connected]: ${memoryUri}`);
      return conn;
    }
  } catch (error: any) {
    console.error(`[MongoDB Error]: ${error.message}`);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
};
