import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Player, Admin, Settings } from "../models/index.js";
import { RateCounter } from '../models/RateCounter.js';
import { RevokedSession } from '../models/RevokedSession.js';

export async function connectDatabase(env) {
  if (!env.MONGODB_URI)
    throw new Error(
      "Set MONGODB_URI in backend/.env before starting the server.",
    );
  mongoose.set('bufferCommands',false);
  await mongoose.connect(env.MONGODB_URI,{serverSelectionTimeoutMS:5000,connectTimeoutMS:5000,socketTimeoutMS:5000,maxPoolSize:20,minPoolSize:0,maxConnecting:2,waitQueueTimeoutMS:2000,maxTimeMS:2000});
}

export async function initializeDatabase(env) {
  await Promise.all([Player.init(), Admin.init(), Settings.init(),RateCounter.init(),RevokedSession.init()]);
  await Settings.updateOne(
    { _id: "tournament" },
    {
      $setOnInsert: {
        payeeName: env.PAYMENT_PAYEE_NAME || "Anubhav Jha",
        upiId: env.PAYMENT_UPI_ID || "8210708838sbi@axl",
        registrationMode: "scheduled",
      },
    },
    { upsert: true },
  );
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    if (env.ADMIN_PASSWORD.length < 12)
      throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
    const email = env.ADMIN_EMAIL.trim().toLowerCase();
    const exists = await Admin.exists({ email });
    if (!exists)
      await Admin.create({
        email,
        passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12),
      });
  }
}
