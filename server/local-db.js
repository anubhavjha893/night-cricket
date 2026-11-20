import { MongoMemoryServer } from 'mongodb-memory-server';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// Development helper: a real local mongod process with a persistent disk path.
// Production uses MONGODB_URI and never imports this module.
const dbPath = path.resolve('.data/mongo');
await mkdir(dbPath, { recursive: true });
const db = await MongoMemoryServer.create({
  binary: { version: '8.0.17' },
  instance: { port: 27017, dbPath, storageEngine: 'wiredTiger' },
});
console.log('Local MongoDB ready at mongodb://127.0.0.1:27017/ugm_cricket');
console.log('Development data is persisted in .data/mongo. Keep this process running.');
async function stop() { await db.stop({ doCleanup: false }); process.exit(0); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
