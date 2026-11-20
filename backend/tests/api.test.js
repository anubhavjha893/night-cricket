import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { randomBytes } from "node:crypto";
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
  roles: JSON.stringify(["Batter", "All-rounder"]),
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

test("duplicate phone and transaction reference are rejected without extra uploaded files", async () => {
  const data = payload();
  await register(
    request.agent(app).set("Origin", "http://localhost:5173"),
    data,
  );
  const count = await mongoose.connection.db
    .collection("uploads.files")
    .countDocuments();
  const phoneDuplicate = await register(
    request.agent(app).set("Origin", "http://localhost:5173"),
    {
      ...data,
      transactionReference: "DIFFERENTUTR123",
    },
  );
  assert.equal(phoneDuplicate.status, 409);
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
