import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { randomBytes, randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { initializeDatabase } from "../src/config/database.js";
import { Player, Settings } from "../src/models/index.js";

const env = {
  NODE_ENV: "test",
  JWT_SECRET: randomBytes(40).toString("hex"),
  ADMIN_EMAIL: "admin@example.test",
  ADMIN_PASSWORD: "Local-test-admin-123!",
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9UQAAAAASUVORK5CYII=",
  "base64",
);
let db, app, admin;
let sequence = 0;
const payload = (overrides = {}) => ({
  name: "Test Cricket Player",
  age: "22",
  phone: `98765${String(++sequence).padStart(5, "0")}`,
  password: "Player-test-pass123",
  address: "Tenughat, Bokaro, Jharkhand 829123",
  roles: JSON.stringify(["Batter"]),
  tshirtSize: "L",
  transactionReference: `TESTUTR${sequence}`,
  declaration: "true",
  ...overrides,
});
async function register(agent, data = payload(), file = png) {
  let call = agent.post("/api/registrations");
  for (const [key, value] of Object.entries(data))
    call = call.field(key, value);
  return call
    .attach("playerPhoto", file, "photo.png")
    .attach("paymentProof", png, "receipt.png");
}
function resubmit(agent, data, revision = 0, key = randomUUID(), proof) {
  let call = agent.post("/api/player/resubmit").set("Idempotency-Key", key);
  for (const [field, value] of Object.entries({
    ...data,
    submissionRevision: String(revision),
  }))
    call = call.field(field, value);
  if (proof) call = call.attach("paymentProof", proof, "corrected-proof.png");
  return call;
}
async function rejectedPlayer() {
  const client = request.agent(app).set("Origin", "http://localhost:5173");
  const data = payload();
  await register(client, data);
  const player = (await client.get("/api/player/me")).body;
  await admin
    .patch(`/api/admin/players/${player._id}/decision`)
    .send({ status: "rejected", reason: "Payment screenshot is not readable." })
    .expect(200);
  return { client, data, player };
}
async function loginAdmin(target = app) {
  const agent = request.agent(target).set("Origin", "http://localhost:5173");
  await agent
    .post("/api/admin/login")
    .send({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
    .expect(200);
  return agent;
}

before(async () => {
  db = await MongoMemoryServer.create({ binary: { version: "8.0.17" } });
  await mongoose.connect(db.getUri(), { dbName: "ugm_api_test" });
  await initializeDatabase(env);
  app = createApp({ env, now: () => new Date("2026-11-25T12:00:00+05:30") });
  admin = await loginAdmin();
});
after(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
});

test("public configuration uses the exact supplied payment account and registration dates", async () => {
  const { body } = await request(app).get("/api/config").expect(200);
  assert.equal(body.fee, 150);
  assert.equal(body.payment.payeeName, "Anubhav Jha");
  assert.equal(body.payment.upiId, "8210708838sbi@axl");
  assert.equal(body.registration.isOpen, true);
  const qr = await request(app)
    .get("/api/payment/qr")
    .expect(200)
    .expect("Content-Type", /image\/png/);
  assert.ok(qr.body.length > 1000);
});

test("registration saves a pending player and private GridFS uploads without exposing password", async () => {
  const agent = request.agent(app).set("Origin", "http://localhost:5173");
  const data = payload();
  const { body, headers } = await register(agent, data);
  assert.equal(body.status, "pending");
  assert.match(body.registrationId, /^UGM2-/);
  assert.ok(headers["set-cookie"][0].includes("HttpOnly"));
  assert.ok(!headers["set-cookie"][0].includes(data.password));
  const { body: player } = await agent.get("/api/player/me").expect(200);
  assert.equal(player.name, data.name);
  assert.equal(player.passwordHash, undefined);
  assert.equal(player.paymentAmount, 150);
  assert.equal(player.notifications[0].kind, "submitted");
  const saved = await Player.findById(player._id).select("+passwordHash");
  assert.notEqual(saved.passwordHash, data.password);
  assert.match(saved.passwordHash, /^\$2/);
  await agent
    .get(`/api/files/${player.playerPhotoId}`)
    .expect(200)
    .expect("Content-Type", /image\/png/);
  await request(app).get(`/api/files/${player.paymentProofId}`).expect(401);
  await agent.get("/api/admin/players").expect(403);
  await agent
    .put("/api/admin/settings")
    .send({ registrationMode: "open" })
    .expect(403);
});

test("new registration needs neither a separate password nor UTR; phone password works and retries are safe", async () => {
  const data = payload();
  delete data.password;
  delete data.transactionReference;
  data.phone = "+91 98765 43210";
  const client = request.agent(app).set("Origin", "http://localhost:5173");
  const submitted = await register(client, data);
  assert.equal(submitted.status, 201);
  const profile = await client.get("/api/player/me").expect(200);
  assert.equal(profile.body.phone, "9876543210");
  assert.equal(profile.body.transactionReference, undefined);
  await client.post("/api/auth/logout").expect(200);
  await client
    .post("/api/auth/login")
    .send({ phone: "9876543210", password: "incorrect" })
    .expect(401);
  await client
    .post("/api/auth/login")
    .send({ phone: "9876543210", password: "9876543210" })
    .expect(200);
  const filesBefore = await mongoose.connection.db
    .collection("uploads.files")
    .countDocuments();
  const retries = await Promise.all([
    register(client, data),
    register(client, data),
  ]);
  assert.deepEqual(
    retries.map((r) => r.status),
    [200, 200],
  );
  assert.equal(await Player.countDocuments({ phone: "9876543210" }), 1);
  assert.equal(
    await mongoose.connection.db.collection("uploads.files").countDocuments(),
    filesBefore,
  );
  const second = payload();
  delete second.password;
  delete second.transactionReference;
  assert.equal((await register(request.agent(app), second)).status, 201);
});

test("health endpoints return only the requested plain text", async () => {
  for (const route of ["/health", "/api/health"]) {
    const response = await request(app)
      .get(route)
      .expect(200)
      .expect("Content-Type", /text\/plain/);
    assert.equal(response.text, "health is good");
  }
});

test("another player cannot view private payment proof or impersonate an administrator", async () => {
  const a = request.agent(app).set("Origin", "http://localhost:5173"),
    b = request.agent(app).set("Origin", "http://localhost:5173");
  await register(a);
  await register(b);
  const { body: player } = await a.get("/api/player/me");
  await b.get(`/api/files/${player.paymentProofId}`).expect(403);
  await b
    .patch(`/api/admin/players/${player._id}/decision`)
    .send({ status: "approved" })
    .expect(403);
  await admin.get(`/api/files/${player.paymentProofId}`).expect(200);
});

test("approval creates one durable player notification and concurrent decisions cannot overwrite it", async () => {
  const agent = request.agent(app).set("Origin", "http://localhost:5173");
  await register(agent);
  const { body: player } = await agent.get("/api/player/me");
  const outcomes = await Promise.all([
    admin
      .patch(`/api/admin/players/${player._id}/decision`)
      .send({ status: "approved" }),
    admin
      .patch(`/api/admin/players/${player._id}/decision`)
      .send({ status: "approved" }),
  ]);
  assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
  const { body: reviewed } = await agent.get("/api/player/me");
  assert.equal(reviewed.status, "approved");
  assert.equal(reviewed.notifications.length, 2);
  assert.match(reviewed.notifications[1].message, /Congratulations/);
  assert.match(reviewed.notifications[1].message, /auction dates/);
  await agent.post("/api/player/notifications/read").expect(200);
  const { body: read } = await agent.get("/api/player/me");
  assert.ok(read.notifications.every((n) => n.readAt));
  await agent.post("/api/auth/logout").expect(200);
  await agent.get("/api/player/me").expect(401);
});

test("rejection requires a reason and the reason survives player sign out and sign in", async () => {
  const agent = request.agent(app).set("Origin", "http://localhost:5173");
  const data = payload();
  await register(agent, data);
  const { body: player } = await agent.get("/api/player/me");
  await admin
    .patch(`/api/admin/players/${player._id}/decision`)
    .send({ status: "rejected", reason: "" })
    .expect(400);
  await admin
    .patch(`/api/admin/players/${player._id}/decision`)
    .send({
      status: "rejected",
      reason: "Payment reference does not match the received credit.",
    })
    .expect(200);
  await agent.post("/api/auth/logout");
  await agent
    .post("/api/auth/login")
    .send({ phone: data.phone, password: data.password })
    .expect(200);
  const { body: reviewed } = await agent.get("/api/player/me");
  assert.equal(reviewed.status, "rejected");
  assert.match(reviewed.notifications.at(-1).message, /does not match/);
});

test("rejected phone recovery signs in once and duplicate references stay blocked", async () => {
  const data = payload();
  delete data.password;
  const client = request.agent(app).set("Origin", "http://localhost:5173");
  await register(client, data);
  const profile = (await client.get("/api/player/me")).body;
  await admin
    .patch(`/api/admin/players/${profile._id}/decision`)
    .send({
      status: "rejected",
      reason: "Please correct the payment screenshot.",
    })
    .expect(200);
  const count = await mongoose.connection.db
    .collection("uploads.files")
    .countDocuments();
  const recoveredClient = request
    .agent(app)
    .set("Origin", "http://localhost:5173");
  const phoneDuplicate = await register(recoveredClient, {
    ...data,
    phone: `+91 ${data.phone}`,
    transactionReference: "DIFFERENTUTR123",
  });
  assert.equal(phoneDuplicate.status, 200);
  assert.match(phoneDuplicate.body.message, /No duplicate was created/);
  const recoveredProfile = await recoveredClient
    .get("/api/player/me")
    .expect(200);
  assert.equal(recoveredProfile.body._id, profile._id);
  assert.equal(recoveredProfile.body.status, "rejected");
  assert.equal(await Player.countDocuments({ phone: data.phone }), 1);
  assert.equal((await Player.findById(profile._id)).status, "rejected");
  const invalidPassword = await register(
    request.agent(app).set("Origin", "http://localhost:5173"),
    {
      ...data,
      phone: `+91 ${data.phone}`,
      password: "Not-the-phone-password",
      transactionReference: "ANOTHERUTR123",
    },
  );
  assert.equal(invalidPassword.status, 409);
  const referenceDuplicate = await register(
    request.agent(app).set("Origin", "http://localhost:5173"),
    {
      ...payload(),
      transactionReference: data.transactionReference,
    },
  );
  assert.equal(referenceDuplicate.status, 409);
  assert.equal(
    await mongoose.connection.db.collection("uploads.files").countDocuments(),
    count,
  );
});

test("server validates roles, required fields, image content and upload size", async () => {
  const validationApp = createApp({
    env,
    now: () => new Date("2026-11-25T12:00:00+05:30"),
  });
  const badRole = await register(
    request.agent(validationApp).set("Origin", "http://localhost:5173"),
    payload({ roles: '["Captain"]' }),
  );
  assert.equal(badRole.status, 400);
  const multipleRoles = await register(
    request.agent(validationApp).set("Origin", "http://localhost:5173"),
    payload({ roles: '["Batter","Bowler"]' }),
  );
  assert.equal(multipleRoles.status, 400);
  const noConsent = await register(
    request.agent(validationApp).set("Origin", "http://localhost:5173"),
    payload({ declaration: "false" }),
  );
  assert.equal(noConsent.status, 400);
  const badImage = await register(
    request.agent(validationApp).set("Origin", "http://localhost:5173"),
    payload(),
    Buffer.from("<svg>unsafe</svg>"),
  );
  assert.equal(badImage.status, 400);
  const oversized = await register(
    request.agent(validationApp).set("Origin", "http://localhost:5173"),
    payload(),
    Buffer.alloc(5 * 1024 * 1024 + 1),
  );
  assert.equal(oversized.status, 400);
  assert.match(oversized.body.message, /5 MB/);
});

test("server enforces India-time opening and closing boundaries", async () => {
  for (const [time, expected] of [
    ["2026-11-23T23:59:59+05:30", false],
    ["2026-11-24T00:00:00+05:30", true],
    ["2026-12-20T23:59:59+05:30", true],
    ["2026-12-21T00:00:00+05:30", false],
  ]) {
    const instance = createApp({ env, now: () => new Date(time) });
    const { body } = await request(instance).get("/api/config");
    assert.equal(body.registration.isOpen, expected, time);
    if (!expected) {
      const response = await register(request.agent(instance));
      assert.equal(response.status, 409);
    }
  }
});

test("admin list is alphabetic, filterable and paginated; search treats regex characters literally", async () => {
  const { body } = await admin
    .get("/api/admin/players?status=pending&page=1")
    .expect(200);
  assert.ok(body.players.every((p) => p.status === "pending"));
  assert.ok(body.players.length <= 20);
  assert.ok(body.counts.approved >= 1);
  assert.ok(body.counts.rejected >= 1);
  const empty = await admin.get("/api/admin/players?search=%5B").expect(200);
  assert.equal(empty.body.total, 0);
});

test("admin overview totals approved collection and detects approval after rejection", async () => {
  const before = (await admin.get("/api/admin/summary").expect(200)).body;
  const { client, data, player } = await rejectedPlayer();
  const rejected = (await admin.get("/api/admin/summary").expect(200)).body;
  assert.equal(rejected.rejected, before.rejected + 1);
  assert.equal(rejected.approvedCollection, before.approved * 150);

  await resubmit(client, data).expect(200);
  await admin
    .patch(`/api/admin/players/${player._id}/decision`)
    .send({ status: "approved", submissionRevision: 1 })
    .expect(200);

  const summary = (await admin.get("/api/admin/summary").expect(200)).body;
  assert.equal(summary.total, before.total + 1);
  assert.equal(summary.approved, before.approved + 1);
  assert.equal(summary.rejected, before.rejected);
  assert.equal(summary.approvedCollection, (before.approved + 1) * 150);
  assert.equal(
    summary.reapprovedAfterRejection,
    before.reapprovedAfterRejection + 1,
  );
  assert.ok(
    summary.reapprovedPlayers.some(
      (entry) => entry.registrationId === player.registrationId,
    ),
  );
});

test("rejected player can correct the same registration, replace proof and retry without duplicates", async () => {
  const { client, data, player } = await rejectedPlayer();
  const original = await Player.findById(player._id).select("+passwordHash");
  const beforeFiles = await mongoose.connection.db
    .collection("uploads.files")
    .countDocuments();
  const key = randomUUID();
  const updatedData = {
    ...data,
    name: "Corrected Cricket Player",
    age: "23",
    status: "approved",
    paymentAmount: "1",
  };
  await resubmit(client, updatedData, 0, key, png).expect(200);
  const corrected = (await client.get("/api/player/me")).body;
  assert.equal(corrected._id, player._id);
  assert.equal(corrected.registrationId, player.registrationId);
  assert.equal(corrected.status, "pending");
  assert.equal(corrected.name, "Corrected Cricket Player");
  assert.equal(corrected.paymentAmount, 150);
  assert.equal(corrected.submissionRevision, 1);
  assert.equal(corrected.rejectionReason, "");
  assert.equal(corrected.reviewedAt, undefined);
  assert.equal(corrected.reviewedBy, undefined);
  assert.equal(corrected.playerPhotoId, player.playerPhotoId);
  assert.notEqual(corrected.paymentProofId, player.paymentProofId);
  assert.equal(corrected.lastResubmissionKey, undefined);
  assert.equal(corrected.notifications.length, 3);
  assert.equal(corrected.notifications.at(-1).kind, "submitted");
  assert.equal(
    (await Player.findById(player._id).select("+passwordHash")).passwordHash,
    original.passwordHash,
  );
  assert.equal(
    await mongoose.connection.db.collection("uploads.files").countDocuments(),
    beforeFiles,
  );
  await client.get(`/api/files/${corrected.paymentProofId}`).expect(200);
  await resubmit(client, updatedData, 0, key, png).expect(200);
  assert.equal((await Player.findById(player._id)).submissionRevision, 1);
  await admin
    .patch(`/api/admin/players/${player._id}/decision`)
    .send({ status: "approved", submissionRevision: 0 })
    .expect(409);
  await admin
    .patch(`/api/admin/players/${player._id}/decision`)
    .send({ status: "approved", submissionRevision: 1 })
    .expect(200);
  await client.post("/api/auth/logout").expect(200);
  await client
    .post("/api/auth/login")
    .send({ phone: data.phone, password: data.password })
    .expect(200);
});

test("resubmission is restricted to the authenticated rejected player and keeps the sign-in number", async () => {
  const { client, data, player } = await rejectedPlayer();
  await request(app).post("/api/player/resubmit").expect(401);
  await resubmit(admin, data).expect(403);
  await client.post("/api/player/resubmit").expect(400);
  const other = request.agent(app).set("Origin", "http://localhost:5173");
  const otherData = payload();
  await register(other, otherData);
  await resubmit(other, { ...data, _id: player._id }).expect(409);
  await resubmit(client, { ...data, phone: otherData.phone }).expect(400);
  assert.equal((await Player.findById(player._id)).phone, data.phone);
  assert.equal((await Player.findById(player._id)).status, "rejected");
});

test("concurrent correction uploads create one revision and clean the losing files", async () => {
  const { client, data, player } = await rejectedPlayer();
  const before = await mongoose.connection.db
    .collection("uploads.files")
    .countDocuments();
  const key = randomUUID();
  const responses = await Promise.all([
    resubmit(client, data, 0, key, png),
    resubmit(client, data, 0, key, png),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [200, 200],
  );
  assert.equal((await Player.findById(player._id)).submissionRevision, 1);
  assert.equal((await Player.findById(player._id)).notifications.length, 3);
  assert.equal(
    await mongoose.connection.db.collection("uploads.files").countDocuments(),
    before,
  );
  await admin
    .patch(`/api/admin/players/${player._id}/decision`)
    .send({
      status: "rejected",
      reason: "Still not readable.",
      submissionRevision: 1,
    })
    .expect(200);
  await resubmit(client, data, 0, randomUUID(), png).expect(409);
  assert.equal(
    await mongoose.connection.db.collection("uploads.files").countDocuments(),
    before,
  );
  await resubmit(client, data, 1, randomUUID()).expect(200);
  assert.equal((await Player.findById(player._id)).submissionRevision, 2);
});

test("invalid corrections leave the rejected profile and original images intact", async () => {
  const { client, data, player } = await rejectedPlayer();
  const before = await mongoose.connection.db
    .collection("uploads.files")
    .countDocuments();
  await resubmit(client, { ...data, age: "200" }).expect(400);
  await resubmit(
    client,
    data,
    0,
    randomUUID(),
    Buffer.from("not-an-image"),
  ).expect(400);
  const current = await Player.findById(player._id);
  assert.equal(current.status, "rejected");
  assert.equal(current.paymentProofId.toString(), player.paymentProofId);
  assert.equal(
    await mongoose.connection.db.collection("uploads.files").countDocuments(),
    before,
  );
});

test("existing rejected applications can be corrected after new registration closes", async () => {
  const { data, player } = await rejectedPlayer();
  const closed = createApp({
    env,
    now: () => new Date("2026-12-22T12:00:00+05:30"),
  });
  const client = request.agent(closed).set("Origin", "http://localhost:5173");
  await client
    .post("/api/auth/login")
    .send({ phone: data.phone, password: data.password })
    .expect(200);
  await resubmit(client, data).expect(200);
  assert.equal((await Player.findById(player._id)).status, "pending");
  await register(request.agent(closed), payload()).then((r) =>
    assert.equal(r.status, 409),
  );
});

test("auction date is admin-only, validates calendar dates and survives older settings clients", async () => {
  const current = (await admin.get("/api/admin/settings").expect(200)).body;
  const fields = {
    payeeName: current.payeeName,
    upiId: current.upiId,
    registrationMode: current.registrationMode,
  };
  await request(app)
    .put("/api/admin/settings")
    .send({ ...fields, auctionDate: "2026-12-23" })
    .expect(401);
  const player = request.agent(app).set("Origin", "http://localhost:5173");
  await register(player);
  await player
    .put("/api/admin/settings")
    .send({ ...fields, auctionDate: "2026-12-23" })
    .expect(403);
  await admin
    .put("/api/admin/settings")
    .send({ ...fields, auctionDate: "2026-12-23" })
    .expect(200);
  assert.equal(
    (await admin.get("/api/admin/settings")).body.auctionDate,
    "2026-12-23",
  );
  for (const auctionDate of ["2026-02-30", "invalid", "2026-13-01"])
    await admin
      .put("/api/admin/settings")
      .send({ ...fields, auctionDate })
      .expect(400);
  await admin.put("/api/admin/settings").send(fields).expect(200);
  assert.equal(
    (await admin.get("/api/admin/settings")).body.auctionDate,
    "2026-12-23",
  );
  await admin
    .put("/api/admin/settings")
    .send({ ...fields, auctionDate: "" })
    .expect(200);
  assert.equal((await admin.get("/api/admin/settings")).body.auctionDate, "");
});

test("admin can update the payment QR and registration availability; cross-origin writes are blocked", async () => {
  await admin
    .put("/api/admin/settings")
    .set("Origin", "https://untrusted.example")
    .send({})
    .expect(403);
  await admin
    .put("/api/admin/settings")
    .field("payeeName", "Anubhav Jha")
    .field("upiId", "8210708838sbi@axl")
    .field("registrationMode", "closed")
    .field("removeQr", "false")
    .attach("paymentQr", png, "qr.png")
    .expect(200);
  const { body } = await request(app).get("/api/config");
  assert.equal(body.registration.isOpen, false);
  assert.equal(body.payment.uploadedQr, true);
  const qr = await request(app).get("/api/payment/qr").expect(200);
  assert.deepEqual(qr.body, png);
  await admin
    .put("/api/admin/settings")
    .field("payeeName", "Anubhav Jha")
    .field("upiId", "8210708838sbi@axl")
    .field("registrationMode", "scheduled")
    .field("removeQr", "true")
    .expect(200);
  const settings = await Settings.findById("tournament");
  assert.equal(settings.qrFileId, undefined);
});
