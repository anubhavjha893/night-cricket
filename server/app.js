import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import QRCode from 'qrcode';
import { z } from 'zod';
import { Admin, Player, Settings } from './models.js';
import { checkImage, saveImage, deleteImage, sendImage } from './files.js';

export const tournament = {
  name: 'Urmila Gupta Memorial Cricket Tournament', season: 2, fee: 150,
  venue: 'Tenughat Golden Jubilee Ground',
  opensAt: '2026-11-24T00:00:00+05:30', closesAt: '2026-12-21T00:00:00+05:30',
};
const phoneSchema = z.string().transform(v => v.replace(/[\s()-]/g, '').replace(/^(\+91|0091)/, '')).pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.'));
const registrationSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(100),
  age: z.coerce.number().int().min(5, 'Age must be between 5 and 100.').max(100),
  phone: phoneSchema,
  address: z.string().trim().min(10, 'Enter your complete address.').max(1000),
  roles: z.array(z.enum(['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'])).min(1, 'Choose at least one player role.').max(4),
  tshirtSize: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']),
  password: z.string().min(8, 'Use a password with at least 8 characters.').max(128),
  transactionReference: z.string().trim().min(6, 'Enter the payment transaction reference / UTR.').max(64).regex(/^[a-zA-Z0-9-]+$/, 'Use only letters, digits or hyphens in the transaction reference.').transform(v => v.toUpperCase()),
  declaration: z.literal('true', { error: 'Please accept the declaration.' }),
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 2, fields: 18, fieldSize: 4096 } });
const fail = (status, message) => Object.assign(new Error(message), { status });
const idIsValid = id => mongoose.isValidObjectId(id);
const cookieName = 'ugm_session';

export async function initializeDatabase(env) {
  await Promise.all([Player.init(), Admin.init(), Settings.init()]);
  await Settings.updateOne({ _id: 'tournament' }, { $setOnInsert: { payeeName: env.PAYMENT_PAYEE_NAME || 'Anubhav Jha', upiId: env.PAYMENT_UPI_ID || '8210708838sbi@axl', registrationMode: 'scheduled' } }, { upsert: true });
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    if (env.ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
    const email = env.ADMIN_EMAIL.trim().toLowerCase();
    const exists = await Admin.exists({ email });
    if (!exists) await Admin.create({ email, passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12) });
  }
}

export function createApp({ env = process.env, now = () => new Date() } = {}) {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('Set JWT_SECRET to a random secret of at least 32 characters.');
  const app = express();
  const origins = (env.APP_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(v => v.trim());
  const production = env.NODE_ENV === 'production';
  app.disable('x-powered-by');
  app.set('trust proxy', Number(env.TRUST_PROXY || 0));
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'blob:'],
    connectSrc: ["'self'"], frameAncestors: ["'none'"], upgradeInsecureRequests: production ? [] : null,
  } } }));
  app.use(cors({ origin(origin, cb) { cb(null, !origin || origins.includes(origin)); }, credentials: true }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && !origins.includes(req.headers.origin)) return res.status(403).json({ message: 'This origin is not allowed.' });
    next();
  });
  app.use('/api', rateLimit({ windowMs: 60000, limit: 200, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many requests. Please try again in a minute.' } }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  const loginLimit = rateLimit({ windowMs: 15 * 60000, limit: 12, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many login attempts. Please try again after 15 minutes.' } });
  const submitLimit = rateLimit({ windowMs: 60 * 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many applications. Please try again later.' } });

  const sessionCookie = { httpOnly: true, secure: production, sameSite: env.COOKIE_SAME_SITE || 'lax', maxAge: 7 * 86400000, path: '/' };
  function setSession(res, user, role) {
    const token = jwt.sign({ sub: String(user._id), role }, env.JWT_SECRET, { expiresIn: '7d', issuer: 'ugm-cricket', audience: 'ugm-players' });
    res.cookie(cookieName, token, sessionCookie);
  }
  async function requireUser(req, res, next) {
    let payload;
    try { payload = jwt.verify(req.cookies[cookieName], env.JWT_SECRET, { issuer: 'ugm-cricket', audience: 'ugm-players', algorithms: ['HS256'] }); }
    catch { throw fail(401, 'Please sign in to continue.'); }
    if (!idIsValid(payload.sub) || !['player', 'admin'].includes(payload.role)) throw fail(401, 'Please sign in again.');
    const user = await (payload.role === 'admin' ? Admin : Player).findById(payload.sub);
    if (!user) throw fail(401, 'Your session is no longer valid. Please sign in.');
    req.user = user; req.role = payload.role; next();
  }
  const adminOnly = [requireUser, (req, res, next) => { if (req.role !== 'admin') throw fail(403, 'Administrator access is required.'); next(); }];
  function registrationWindow(settings) {
    const current = now().getTime();
    const isOpen = settings.registrationMode === 'open' || (settings.registrationMode === 'scheduled' && current >= Date.parse(tournament.opensAt) && current < Date.parse(tournament.closesAt));
    let message = 'Registration is open. Submit by 20 December 2026.';
    if (!isOpen) message = current < Date.parse(tournament.opensAt) && settings.registrationMode !== 'closed' ? 'Registration opens on 24 November 2026.' : 'Registration is closed. Contact the organisers for assistance.';
    return { isOpen, message };
  }

  app.get('/api/health', (req, res) => res.json({ ok: mongoose.connection.readyState === 1 }));
  app.get('/api/config', async (req, res) => {
    const settings = await Settings.findById('tournament');
    res.json({ ...tournament, registration: registrationWindow(settings), payment: {
      configured: Boolean(settings.qrFileId || settings.upiId), uploadedQr: Boolean(settings.qrFileId), payeeName: settings.payeeName,
      upiId: settings.upiId, qrUrl: settings.qrFileId || settings.upiId ? '/api/payment/qr' : null,
      amount: tournament.fee,
    } });
  });
  app.get('/api/payment/qr', async (req, res) => {
    const settings = await Settings.findById('tournament');
    if (settings.qrFileId) return sendImage(settings.qrFileId, res);
    if (!settings.upiId) throw fail(503, 'The organiser has not configured the payment QR yet.');
    const params = new URLSearchParams({ pa: settings.upiId, pn: settings.payeeName, am: String(tournament.fee), cu: 'INR', tn: 'UGM Season 2 registration' });
    const png = await QRCode.toBuffer(`upi://pay?${params}`, { width: 400, margin: 3, errorCorrectionLevel: 'M' });
    res.type('png').send(png);
  });

  app.post('/api/registrations', submitLimit, upload.fields([{ name: 'playerPhoto', maxCount: 1 }, { name: 'paymentProof', maxCount: 1 }]), async (req, res) => {
    const settings = await Settings.findById('tournament');
    const window = registrationWindow(settings);
    if (!window.isOpen) throw fail(409, window.message);
    if (!settings.qrFileId && !settings.upiId) throw fail(503, 'Payment is not configured yet. Please contact the organiser.');
    let roles;
    try { roles = JSON.parse(req.body.roles || '[]'); } catch { throw fail(400, 'Select your player role.'); }
    const result = registrationSchema.safeParse({ ...req.body, roles });
    if (!result.success) return res.status(400).json({ message: 'Please check your registration details.', errors: result.error.flatten().fieldErrors });
    const { password, declaration, ...data } = result.data;
    if (await Player.exists({ phone: data.phone })) throw fail(409, 'This mobile number is already registered. Sign in to track your application.');
    if (await Player.exists({ transactionReference: data.transactionReference })) throw fail(409, 'This payment reference has already been submitted. Contact the organiser.');
    const photo = await checkImage(req.files?.playerPhoto?.[0], 'Player photograph');
    const proof = await checkImage(req.files?.paymentProof?.[0], 'Payment screenshot');
    const saved = [];
    try {
      const playerPhotoId = await saveImage(photo, 'player-photo'); saved.push(playerPhotoId);
      const paymentProofId = await saveImage(proof, 'payment-proof'); saved.push(paymentProofId);
      const player = await Player.create({
        ...data, playerPhotoId, paymentProofId, passwordHash: await bcrypt.hash(password, 12),
        registrationId: `UGM2-${randomBytes(6).toString('hex').toUpperCase()}`,
        paymentAmount: tournament.fee,
        notifications: [{ kind: 'submitted', message: 'Your registration has been received and is pending payment and player-detail verification.' }],
      });
      setSession(res, player, 'player');
      res.status(201).json({ registrationId: player.registrationId, status: player.status, message: 'Registration received. Verification is pending.' });
    } catch (error) { await Promise.all(saved.map(deleteImage)); throw error; }
  });

  app.post('/api/auth/login', loginLimit, async (req, res) => {
    const parsed = z.object({ phone: phoneSchema, password: z.string().max(128) }).safeParse(req.body);
    if (!parsed.success) throw fail(400, 'Enter your mobile number and password.');
    const player = await Player.findOne({ phone: parsed.data.phone }).select('+passwordHash');
    const valid = player ? await bcrypt.compare(parsed.data.password, player.passwordHash) : await bcrypt.compare(parsed.data.password, '$2b$12$C6UzMDM.H6dfI/f/IKcEe.1GiCrgKvBjSLcNbTKO3du.4zOw7O2m2');
    if (!player || !valid) throw fail(401, 'Mobile number or password is incorrect.');
    setSession(res, player, 'player'); res.json({ role: 'player', name: player.name });
  });
  app.post('/api/admin/login', loginLimit, async (req, res) => {
    const result = z.object({ email: z.email(), password: z.string().max(128) }).safeParse(req.body);
    if (!result.success) throw fail(400, 'Enter your admin email and password.');
    const admin = await Admin.findOne({ email: result.data.email.toLowerCase() }).select('+passwordHash');
    const valid = admin ? await bcrypt.compare(result.data.password, admin.passwordHash) : await bcrypt.compare(result.data.password, '$2b$12$C6UzMDM.H6dfI/f/IKcEe.1GiCrgKvBjSLcNbTKO3du.4zOw7O2m2');
    if (!admin || !valid) throw fail(401, 'Email or password is incorrect.');
    setSession(res, admin, 'admin'); res.json({ role: 'admin', email: admin.email });
  });
  app.post('/api/auth/logout', (req, res) => { res.clearCookie(cookieName, { ...sessionCookie, maxAge: undefined }); res.json({ ok: true }); });
  app.get('/api/auth/me', requireUser, (req, res) => res.json({ role: req.role, name: req.user.name, email: req.user.email }));
  app.get('/api/player/me', requireUser, (req, res) => {
    if (req.role !== 'player') throw fail(403, 'Sign in as a player to view your registration.');
    const player = req.user.toObject(); delete player.reviewedBy;
    res.json(player);
  });
  app.post('/api/player/notifications/read', requireUser, async (req, res) => {
    if (req.role !== 'player') throw fail(403, 'Player access required.');
    await Player.updateOne({ _id: req.user._id }, { $set: { 'notifications.$[unread].readAt': new Date() } }, { arrayFilters: [{ 'unread.readAt': { $exists: false } }] });
    res.json({ ok: true });
  });
  app.get('/api/files/:id', requireUser, async (req, res) => {
    if (!idIsValid(req.params.id)) throw fail(404, 'Image not found.');
    if (req.role !== 'admin' && ![req.user.playerPhotoId, req.user.paymentProofId].some(id => String(id) === req.params.id)) throw fail(403, 'You cannot view this image.');
    return sendImage(req.params.id, res);
  });

  app.get('/api/admin/players', ...adminOnly, async (req, res) => {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null;
    const search = String(req.query.search || '').trim().slice(0, 100);
    const filter = status ? { status } : {};
    if (search) filter.$or = ['name', 'phone', 'registrationId'].map(key => ({ [key]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }));
    const page = Math.max(1, Math.min(Number.parseInt(req.query.page, 10) || 1, 100000));
    const [players, total, groups] = await Promise.all([
      Player.find(filter).select('name phone registrationId roles status createdAt').sort({ name: 1, _id: 1 }).skip((page - 1) * 20).limit(20).lean(),
      Player.countDocuments(filter),
      Player.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    res.json({ players, total, page, pages: Math.ceil(total / 20), counts: Object.fromEntries(groups.map(group => [group._id, group.count])) });
  });
  app.get('/api/admin/players/:id', ...adminOnly, async (req, res) => {
    if (!idIsValid(req.params.id)) throw fail(404, 'Player not found.');
    const player = await Player.findById(req.params.id).lean();
    if (!player) throw fail(404, 'Player not found.'); res.json(player);
  });
  app.patch('/api/admin/players/:id/decision', ...adminOnly, async (req, res) => {
    if (!idIsValid(req.params.id)) throw fail(404, 'Player not found.');
    const result = z.object({ status: z.enum(['approved', 'rejected']), reason: z.string().trim().max(1000).default('') }).safeParse(req.body);
    if (!result.success) throw fail(400, 'Choose approve or reject and enter a valid reason.');
    const { status, reason } = result.data;
    if (status === 'rejected' && reason.length < 5) throw fail(400, 'Give a clear rejection reason of at least 5 characters.');
    const existing = await Player.findById(req.params.id);
    if (!existing) throw fail(404, 'Player not found.');
    const message = status === 'approved'
      ? `Congratulations, ${existing.name}! Your details and payment have been verified for UGM Cricket Season 2. We will inform you soon about the auction dates.`
      : `Your UGM Cricket Season 2 registration was rejected. Reason: ${reason}`;
    const updated = await Player.findOneAndUpdate({ _id: req.params.id, status: 'pending' }, {
      $set: { status, rejectionReason: status === 'rejected' ? reason : '', reviewedAt: new Date(), reviewedBy: req.user._id },
      $push: { notifications: { kind: status, message, createdAt: new Date() } },
    }, { returnDocument: 'after' });
    if (!updated) throw fail(409, 'This application has already been reviewed. Refresh to see its current status.');
    res.json({ status: updated.status, message: 'Decision saved. The player’s in-app notification has been created.' });
  });
  app.get('/api/admin/settings', ...adminOnly, async (req, res) => res.json(await Settings.findById('tournament').lean()));
  app.put('/api/admin/settings', ...adminOnly, upload.single('paymentQr'), async (req, res) => {
    const result = z.object({
      payeeName: z.string().trim().min(2).max(100),
      upiId: z.union([z.literal(''), z.string().trim().regex(/^[\w.\-]{2,256}@[a-zA-Z0-9.\-]{2,64}$/, 'Enter a valid UPI ID.')]),
      registrationMode: z.enum(['scheduled', 'open', 'closed']),
      removeQr: z.enum(['true', 'false']).default('false'),
    }).safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: 'Check your payment and registration settings.', errors: result.error.flatten().fieldErrors });
    const old = await Settings.findById('tournament');
    let newFileId;
    try {
      if (req.file) newFileId = await saveImage(await checkImage(req.file, 'Payment QR'), 'payment-qr');
      const update = { payeeName: result.data.payeeName, upiId: result.data.upiId, registrationMode: result.data.registrationMode };
      if (newFileId) update.qrFileId = newFileId;
      const query = { $set: update };
      if (!newFileId && result.data.removeQr === 'true') query.$unset = { qrFileId: 1 };
      const settings = await Settings.findByIdAndUpdate('tournament', query, { returnDocument: 'after' });
      if ((newFileId || result.data.removeQr === 'true') && old.qrFileId) await deleteImage(old.qrFileId);
      res.json({ message: 'Settings saved.', settings });
    } catch (error) { await deleteImage(newFileId); throw error; }
  });
  app.use('/api', (req, res) => res.status(404).json({ message: 'API endpoint not found.' }));

  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  if (existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false }));
    app.get('/{*path}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof multer.MulterError) return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5 MB or smaller.' : 'Please upload only the requested images and fields.' });
    if (error.code === 11000) return res.status(409).json({ message: 'This mobile number or payment reference is already registered. Sign in or contact the organiser.' });
    const status = error.status || 500;
    if (status >= 500) console.error('Request failed:', error.name);
    res.status(status).json({ message: status >= 500 ? (error.status ? error.message : 'Something went wrong. Please try again.') : error.message });
  });
  return app;
}
