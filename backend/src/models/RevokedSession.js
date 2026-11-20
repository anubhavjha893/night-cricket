import mongoose from "mongoose";
const schema = new mongoose.Schema(
  { _id: String, expiresAt: { type: Date, required: true } },
  { versionKey: false },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RevokedSession =
  mongoose.models.RevokedSession || mongoose.model("RevokedSession", schema);
