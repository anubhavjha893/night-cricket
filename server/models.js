import mongoose from 'mongoose';

const { Schema } = mongoose;
const notification = new Schema({
  message: { type: String, required: true },
  kind: { type: String, enum: ['submitted', 'approved', 'rejected'], required: true },
  createdAt: { type: Date, default: Date.now },
  readAt: Date,
});

const playerSchema = new Schema({
  registrationId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  age: { type: Number, required: true },
  address: { type: String, required: true },
  roles: [{ type: String, enum: ['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'] }],
  tshirtSize: { type: String, required: true },
  passwordHash: { type: String, required: true, select: false },
  playerPhotoId: { type: Schema.Types.ObjectId, required: true },
  paymentProofId: { type: Schema.Types.ObjectId, required: true },
  transactionReference: { type: String, required: true, unique: true },
  paymentAmount: { type: Number, default: 150 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  rejectionReason: { type: String, default: '' },
  reviewedAt: Date,
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  notifications: [notification],
}, { timestamps: true });
playerSchema.index({ name: 1, createdAt: -1 });

const adminSchema = new Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
}, { timestamps: true });

const settingsSchema = new Schema({
  _id: { type: String, default: 'tournament' },
  payeeName: { type: String, default: 'Anubhav Jha' },
  upiId: { type: String, default: '8210708838sbi@axl' },
  qrFileId: Schema.Types.ObjectId,
  registrationMode: { type: String, enum: ['scheduled', 'open', 'closed'], default: 'scheduled' },
}, { timestamps: true });

export const Player = mongoose.models.Player || mongoose.model('Player', playerSchema);
export const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
