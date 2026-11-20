import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp, initializeDatabase } from './app.js';

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env before starting the server.');
const app = createApp();
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await initializeDatabase(process.env);
const server = app.listen(Number(process.env.PORT || 4000), () => console.log(`UGM Cricket server ready on http://localhost:${process.env.PORT || 4000}`));
async function shutdown() {
  server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
