import mongoose from "mongoose";

const { Schema } = mongoose;
const adminSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    passwordScheme: { type: String, enum: ["sha256-bcrypt-v1"], select: false },
  },
  { timestamps: true },
);

export const Admin =
  mongoose.models.Admin || mongoose.model("Admin", adminSchema);
