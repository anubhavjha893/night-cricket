import mongoose from "mongoose";

const { Schema } = mongoose;
const settingsSchema = new Schema(
  {
    _id: { type: String, default: "tournament" },
    payeeName: { type: String, default: "Anubhav Jha" },
    upiId: { type: String, default: "8210708838sbi@axl" },
    qrFileId: Schema.Types.ObjectId,
    registrationMode: {
      type: String,
      enum: ["scheduled", "open", "closed"],
      default: "scheduled",
    },
  },
  { timestamps: true },
);

export const Settings =
  mongoose.models.Settings || mongoose.model("Settings", settingsSchema);
