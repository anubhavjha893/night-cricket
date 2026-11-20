import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

const { Schema } = mongoose;
const notification = new Schema({
  message: { type: String, required: true },
  kind: {
    type: String,
    enum: ["submitted", "approved", "rejected"],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
  readAt: Date,
});

const playerSchema = new Schema(
  {
    registrationId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    age: { type: Number, required: true },
    address: { type: String, required: true },
    roles: [
      {
        type: String,
        enum: ["Batter", "Bowler", "All-rounder", "Wicketkeeper"],
      },
    ],
    tshirtSize: { type: String, required: true },
    passwordHash: { type: String, required: true, select: false },
    passwordScheme: { type: String, enum: ["sha256-bcrypt-v1"], select: false },
    playerPhotoId: { type: Schema.Types.ObjectId, required: true },
    paymentProofId: { type: Schema.Types.ObjectId, required: true },
    // Retain the existing unique index without inventing a payment reference.
    // Missing references receive an internal marker, hidden from API responses.
    transactionReference: {
      type: String,
      required: true,
      unique: true,
      select: false,
      default: () => `NOT-COLLECTED-${randomUUID()}`,
    },
    paymentAmount: { type: Number, default: 150 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    submissionRevision: { type: Number, default: 0 },
    lastResubmissionKey: { type: String, select: false },
    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    notifications: [notification],
  },
  { timestamps: true },
);
playerSchema.index({ name: 1, createdAt: -1 });
playerSchema.index({ status: 1, name: 1, _id: 1 });

export const Player =
  mongoose.models.Player || mongoose.model("Player", playerSchema);
