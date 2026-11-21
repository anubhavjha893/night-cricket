import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { connectDatabase, initializeDatabase } from "../src/config/database.js";
import { Admin, Player, Settings } from "../src/models/index.js";
import { RateCounter } from "../src/models/RateCounter.js";
import { RevokedSession } from "../src/models/RevokedSession.js";
import { sharedLimiter } from "../src/middleware/rate-limit.middleware.js";
import {
  createWorkGate,
  runWork,
} from "../src/middleware/work-limit.middleware.js";
import http from "node:http";
import {
  configureHttpServer,
  installShutdown,
} from "../src/config/http-server.js";
import legacyBcrypt from "bcryptjs";

const origin = "http://localhost:5173";
const env = {
  NODE_ENV: "test",
  JWT_SECRET: randomBytes(40).toString("hex"),
  ADMIN_EMAIL: "security@example.test",
  ADMIN_PASSWORD: "Synthetic-security-admin123!",
  APP_ORIGIN: origin,
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9UQAAAAASUVORK5CYII=",
  "base64",
);
let db,
  app,
  admin,
  number = 0;
const agent = (target = app) => request.agent(target).set("Origin", origin);
const fields = (override = {}) => ({
  name: "Synthetic Security Player",
  age: "23",
  phone: `97777${String(++number).padStart(5, "0")}`,
  password: "Synthetic-player-pass123!",
  address: "Synthetic test address only",
  roles: '["Batter"]',
  tshirtSize: "L",
  transactionReference: `SECURITY${number}TEST`,
  declaration: "true",
  ...override,
});
function register(client, data = fields(), photo = png) {
  let call = client.post("/api/registrations");
  for (const [k, v] of Object.entries(data)) call = call.field(k, v);
  return call
    .attach("playerPhoto", photo, "photo.png")
    .attach("paymentProof", png, "proof.png");
}
async function login(target = app) {
  const response = await request(target)
    .post("/api/admin/login")
    .set("Origin", origin)
    .send({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
    .expect(200);
  return response.headers["set-cookie"][0].split(";")[0];
}
before(async () => {
  db = await MongoMemoryServer.create({ binary: { version: "8.0.17" } });
  await connectDatabase({ ...env, MONGODB_URI: db.getUri("security_test") });
  await initializeDatabase(env);
  app = createApp({ env, now: () => new Date("2026-11-25T12:00:00+05:30") });
  admin = agent();
  await admin
    .post("/api/admin/login")
    .send({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
    .expect(200);
});
after(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
});

test("logout revokes captured cookies across instances, including legacy JWTs; new login still works", async () => {
  const cookie = await login();
  await request(app)
    .post("/api/auth/logout")
    .set("Origin", origin)
    .set("Cookie", cookie)
    .expect(200);
  const other = createApp({ env });
  await request(other).get("/api/auth/me").set("Cookie", cookie).expect(401);
  const second = await login();
  assert.notEqual(second, cookie);
  await request(other).get("/api/auth/me").set("Cookie", second).expect(200);
  const owner = await Admin.findOne({ email: env.ADMIN_EMAIL });
  const legacy =
    "ugm_session=" +
    jwt.sign({ sub: String(owner._id), role: "admin" }, env.JWT_SECRET, {
      issuer: "ugm-cricket",
      audience: "ugm-players",
      expiresIn: "7d",
    });
  await request(app)
    .post("/api/auth/logout")
    .set("Origin", origin)
    .set("Cookie", legacy)
    .expect(200);
  await request(other).get("/api/auth/me").set("Cookie", legacy).expect(401);
  const expired =
    "ugm_session=" +
    jwt.sign({ sub: String(owner._id), role: "admin" }, env.JWT_SECRET, {
      issuer: "ugm-cricket",
      audience: "ugm-players",
      expiresIn: -1,
    });
  await request(app).get("/api/auth/me").set("Cookie", expired).expect(401);
  await request(app)
    .get("/api/auth/me")
    .set("Cookie", "ugm_session=invalid-token")
    .expect(401);
});

test("all admin operations and metrics are protected; private files require ownership", async () => {
  const player = agent();
  await register(player);
  const profile = (await player.get("/api/player/me")).body;
  for (const [method, path] of [
    ["get", "/api/admin/players"],
    ["get", `/api/admin/players/${profile._id}`],
    ["patch", `/api/admin/players/${profile._id}/decision`],
    ["get", "/api/admin/summary"],
    ["get", "/api/admin/settings"],
    ["put", "/api/admin/settings"],
    ["get", "/api/admin/metrics"],
  ]) {
    await request(app)[method](path).expect(401);
    await player[method](path).expect(403);
  }
  const another = agent();
  await register(another);
  await another.get(`/api/files/${profile.paymentProofId}`).expect(403);
  await request(app).get(`/api/files/${profile.playerPhotoId}`).expect(401);
  await admin.get(`/api/files/${profile.paymentProofId}`).expect(200);
  const metrics = await admin.get("/api/admin/metrics").expect(200);
  assert.ok(!JSON.stringify(metrics.body).includes(profile.phone));
  assert.ok(!JSON.stringify(metrics.body).includes(profile.name));
});

test("cookie-authenticated changes reject missing, null and untrusted origins", async () => {
  const cookie = await login();
  await request(app).post("/api/auth/logout").set("Cookie", cookie).expect(403);
  await request(app)
    .post("/api/auth/logout")
    .set("Cookie", cookie)
    .set("Origin", "null")
    .expect(403);
  await request(app)
    .post("/api/auth/logout")
    .set("Cookie", cookie)
    .set("Origin", "https://attacker.test")
    .expect(403);
  await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
  await request(app)
    .post("/api/auth/logout")
    .set("Cookie", cookie)
    .set("Origin", origin)
    .expect(200);
});

test("rate limits are atomic across app instances, expire by window, hash identity and return Retry-After", async () => {
  let now = 1000;
  const isolated = { ...env, JWT_SECRET: randomBytes(40).toString("hex") };
  const make = () => {
    const target = express();
    target.get(
      "/limited",
      sharedLimiter({
        env: isolated,
        scope: "boundary",
        windowMs: 1000,
        limit: 2,
        now: () => now,
      }),
      (_, res) => res.json({ ok: true }),
    );
    return target;
  };
  const a = make(),
    b = make();
  const responses = await Promise.all([
    request(a).get("/limited"),
    request(b).get("/limited"),
    request(a).get("/limited"),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 200, 429]);
  const blocked = responses.find((r) => r.status === 429);
  assert.ok(Number(blocked.headers["retry-after"]) >= 1);
  assert.ok(blocked.body.retryAfterSeconds >= 1);
  now = 2000;
  await request(b).get("/limited").expect(200);
  const counters = await RateCounter.find().lean();
  assert.ok(counters.every((c) => /^[a-f0-9]{64}$/.test(c._id)));
  assert.ok(
    (await RateCounter.collection.indexes()).some(
      (i) => i.expireAfterSeconds === 0,
    ),
  );
});

test("login failures target an account without locking every user on the same IP; forwarded identity cannot evade limits", async () => {
  const custom = {
    ...env,
    JWT_SECRET: randomBytes(40).toString("hex"),
    RATE_LOGIN_ACCOUNT: "2",
  };
  const a = createApp({ env: custom }),
    b = createApp({ env: custom });
  for (const target of [a, b])
    await request(target)
      .post("/api/admin/login")
      .send({ email: env.ADMIN_EMAIL, password: "incorrect" })
      .expect(401);
  await request(a)
    .post("/api/admin/login")
    .send({ email: env.ADMIN_EMAIL, password: "incorrect" })
    .expect(429);
  await request(a)
    .post("/api/admin/login")
    .send({ email: "another@example.test", password: "incorrect" })
    .expect(401);
  const restricted = createApp({
    env: {
      ...env,
      JWT_SECRET: randomBytes(40).toString("hex"),
      RATE_API_PER_MINUTE: "1",
    },
  });
  await request(restricted)
    .get("/api/config")
    .set("X-Forwarded-For", "1.2.3.4")
    .expect(200);
  await request(restricted)
    .get("/api/config")
    .set("X-Forwarded-For", "8.8.8.8")
    .expect(429);
  assert.throws(
    () => createApp({ env: { ...env, TRUST_PROXY: "1" } }),
    /TRUSTED_PROXY_CIDRS/,
  );
  assert.throws(
    () => createApp({ env: { ...env, TRUSTED_PROXY_CIDRS: "0.0.0.0/0" } }),
    /exact proxy/,
  );
});

test("production requires HTTPS origins and uses Secure HttpOnly cookies", async () => {
  assert.throws(
    () => createApp({ env: { ...env, NODE_ENV: "production" } }),
    /HTTPS/,
  );
  const production = createApp({
    env: {
      ...env,
      NODE_ENV: "production",
      APP_ORIGIN: "https://secure.example.test",
    },
  });
  const response = await request(production)
    .post("/api/admin/login")
    .set("Origin", "https://secure.example.test")
    .send({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
    .expect(200);
  const cookie = response.headers["set-cookie"][0];
  assert.match(cookie, /Secure/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
});

test("normal registration retries recover the same application and concurrent duplicates leave exactly two files", async () => {
  const data = fields();
  const before = await mongoose.connection.db
    .collection("uploads.files")
    .countDocuments();
  const responses = await Promise.all([
    register(agent(), data),
    register(agent(), data),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]);
  assert.equal(
    responses[0].body.registrationId,
    responses[1].body.registrationId,
  );
  assert.equal(await Player.countDocuments({ phone: data.phone }), 1);
  assert.equal(
    await mongoose.connection.db.collection("uploads.files").countDocuments(),
    before + 2,
  );
  const retry = await register(agent(), data);
  assert.equal(retry.status, 200);
  const bad = await register(agent(), {
    ...data,
    password: "Wrong-password123!",
  });
  assert.equal(bad.status, 409);
});

test("new full-input password hashes distinguish suffixes beyond 72 bytes; legacy accounts upgrade without resetting passwords", async () => {
  const enabled = {
    ...env,
    PASSWORD_SCHEME_ENABLED: "true",
    JWT_SECRET: randomBytes(40).toString("hex"),
  };
  const target = createApp({
    env: enabled,
    now: () => new Date("2026-11-25T12:00:00+05:30"),
  });
  const password = "x".repeat(72) + "-suffix-a";
  const data = fields({ password });
  const client = agent(target);
  const created = await register(client, data);
  assert.equal(created.status, 201);
  await client.post("/api/auth/logout").expect(200);
  await client
    .post("/api/auth/login")
    .send({ phone: data.phone, password: "x".repeat(72) + "-suffix-b" })
    .expect(401);
  await client
    .post("/api/auth/login")
    .send({ phone: data.phone, password })
    .expect(200);
  const stored = await Player.findOne({ phone: data.phone }).select(
    "+passwordScheme",
  );
  assert.equal(stored.passwordScheme, "sha256-bcrypt-v1");
  const oldPassword = "Synthetic-legacy-pass123!";
  const legacy = await Admin.create({
    email: "legacy@example.test",
    passwordHash: await legacyBcrypt.hash(oldPassword, 12),
  });
  await request(target)
    .post("/api/admin/login")
    .send({ email: legacy.email, password: oldPassword })
    .expect(200);
  assert.equal(
    (await Admin.findById(legacy._id).select("+passwordScheme")).passwordScheme,
    "sha256-bcrypt-v1",
  );
  const rolling = await register(agent(), fields({ password }));
  assert.equal(rolling.status, 400);
  assert.ok(rolling.body.errors.password);
});

test("closed registration rejects the request before multipart processing; malformed images produce 400", async () => {
  const closed = createApp({
    env,
    now: () => new Date("2026-11-20T12:00:00+05:30"),
  });
  await request(closed)
    .post("/api/registrations")
    .set("Content-Type", "multipart/form-data; boundary=broken")
    .send(Buffer.from("invalid multipart"))
    .expect(409);
  const response = await register(
    agent(),
    fields(),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  assert.equal(response.status, 400);
  const invalid = await request(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send("SYNTHETIC_SECRET_MARKER")
    .expect(400);
  assert.ok(!JSON.stringify(invalid.body).includes("SYNTHETIC_SECRET_MARKER"));
  await request(app)
    .post("/api/auth/login")
    .send({ password: "x".repeat(40000) })
    .expect(413);
  await admin.get("/api/admin/players?page=501").expect(400);
  await admin.get("/api/admin/players?page=1.5").expect(400);
});

test("expensive-work admission is bounded and releases capacity after a response", async () => {
  const gate = createWorkGate(1),
    target = express();
  let release;
  let visits = 0;
  target.get(
    "/work",
    gate.middleware,
    runWork(async (_, res) => {
      if (++visits === 1) await new Promise((resolve) => (release = resolve));
      res.json({ ok: true });
    }),
  );
  const first = request(target)
    .get("/work")
    .then((r) => r);
  while (!release) await new Promise((resolve) => setTimeout(resolve, 2));
  const second = await request(target).get("/work").expect(503);
  assert.equal(second.headers["retry-after"], "2");
  assert.equal(gate.active(), 1);
  release();
  assert.equal((await first).status, 200);
  await request(target).get("/work").expect(200);
  assert.equal(gate.active(), 0);
});

test("disconnecting a client does not release a password-work slot before computation finishes", async () => {
  const gate = createWorkGate(1),
    target = express();
  let release;
  target.get(
    "/work",
    gate.middleware,
    runWork(async (_, res) => {
      await new Promise((resolve) => (release = resolve));
      res.end("ok");
    }),
  );
  const server = target.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = `http://127.0.0.1:${server.address().port}/work`;
  const client = http.get(address);
  client.on("error", () => {});
  try {
    while (!release) await new Promise((resolve) => setTimeout(resolve, 2));
    client.destroy();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(gate.active(), 1);
    await request(target).get("/work").expect(503);
    release();
    while (gate.active())
      await new Promise((resolve) => setTimeout(resolve, 2));
    assert.equal(gate.active(), 0);
  } finally {
    client.destroy();
    release?.();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("concurrent payment settings updates cannot delete the active QR or orphan a competing upload", async () => {
  const original = Settings.findOneAndUpdate;
  let arrived = 0,
    release;
  const barrier = new Promise((resolve) => (release = resolve));
  Settings.findOneAndUpdate = async function (...args) {
    if (++arrived === 2) release();
    await barrier;
    return original.apply(this, args);
  };
  const before = await mongoose.connection.db
    .collection("uploads.files")
    .countDocuments();
  const update = () =>
    admin
      .put("/api/admin/settings")
      .field("payeeName", "Synthetic Payee")
      .field("upiId", "synthetic@bank")
      .field("registrationMode", "scheduled")
      .field("removeQr", "false")
      .attach("paymentQr", png, "qr.png");
  try {
    const responses = await Promise.all([update(), update()]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  } finally {
    Settings.findOneAndUpdate = original;
  }
  const settings = await Settings.findById("tournament");
  assert.ok(
    await mongoose.connection.db
      .collection("uploads.files")
      .findOne({ _id: settings.qrFileId }),
  );
  assert.equal(
    await mongoose.connection.db.collection("uploads.files").countDocuments(),
    before + 1,
  );
});

test("failed logout storage leaves the session active and returns retryable failure", async () => {
  const cookie = await login();
  const original = RevokedSession.updateOne;
  RevokedSession.updateOne = async () => {
    throw Object.assign(new Error("synthetic failure"), {
      name: "MongoNetworkError",
    });
  };
  try {
    const response = await request(app)
      .post("/api/auth/logout")
      .set("Origin", origin)
      .set("Cookie", cookie)
      .expect(503);
    assert.equal(response.headers["set-cookie"], undefined);
  } finally {
    RevokedSession.updateOne = original;
  }
  await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
});

test("HTTP timeouts and shutdown drain are bounded and reject new readiness checks", async () => {
  const target = createApp({ env }),
    server = target.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  configureHttpServer(server);
  assert.equal(server.requestTimeout, 30000);
  assert.equal(server.headersTimeout, 10000);
  assert.equal(server.keepAliveTimeout, 5000);
  let disconnected = false,
    exitCode;
  const done = new Promise((resolve) => {
    const shutdown = installShutdown(
      server,
      target,
      async () => {
        disconnected = true;
      },
      {
        exit: (code) => {
          exitCode = code;
          resolve();
        },
      },
    );
    shutdown();
    shutdown();
  });
  await done;
  assert.equal(exitCode, 0);
  assert.equal(disconnected, true);
  assert.equal(target.locals.draining, true);
  await request(target).get("/api/ready").expect(503);
  await request(target).get("/api/config").expect(503);
});

test("shutdown allows an already-running response to finish before database disconnect", async () => {
  const target = express();
  let release, started;
  const received = new Promise((resolve) => (started = resolve));
  target.get("/slow", async (_, res) => {
    started();
    await new Promise((resolve) => (release = resolve));
    res.end("complete");
  });
  const server = target.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const response = fetch(`http://127.0.0.1:${server.address().port}/slow`);
  await received;
  let disconnected = false;
  let finished;
  const done = new Promise((resolve) => (finished = resolve));
  const shutdown = installShutdown(
    server,
    target,
    async () => {
      disconnected = true;
    },
    {
      exit: (code) => {
        assert.equal(code, 0);
        finished();
      },
    },
  );
  shutdown();
  assert.equal(disconnected, false);
  release();
  assert.equal(await (await response).text(), "complete");
  await done;
  assert.equal(disconnected, true);
});

test("readiness coalesces parallel probes so public checks cannot fan out database work", async () => {
  const target = createApp({ env });
  const original = mongoose.connection.db.command;
  let pings = 0;
  mongoose.connection.db.command = function (command, ...rest) {
    if (command.ping) pings++;
    return original.call(this, command, ...rest);
  };
  try {
    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        request(target).get(index % 2 ? "/health" : "/api/ready"),
      ),
    );
    assert.ok(responses.every((r) => r.status === 200));
    assert.equal(pings, 1);
  } finally {
    mongoose.connection.db.command = original;
  }
});

test("monitor health checks report failed Atlas pings and do not cache healthy responses", async () => {
  for (const route of ["/health", "/api/health"]) {
    const healthy = await request(app).get(route).expect(200);
    assert.equal(healthy.text, "health is good");
    assert.equal(healthy.headers["cache-control"], "no-store");
    await request(app).head(route).expect(200);
  }
  const original = mongoose.connection.db.command;
  mongoose.connection.db.command = async () => {
    throw new Error("Synthetic ping failure");
  };
  try {
    const target = createApp({ env });
    await request(target).get("/health").expect(503);
    await request(target).get("/api/ready").expect(503);
    await request(target).get("/api/live").expect(200);
  } finally {
    mongoose.connection.db.command = original;
  }
});

test("actual database loss fails readiness/API quickly while liveness stays healthy", async () => {
  await request(app).get("/api/ready").expect(200);
  await mongoose.disconnect();
  const started = Date.now();
  await request(app).get("/api/ready").timeout(2000).expect(503);
  await request(app).get("/api/config").timeout(2000).expect(503);
  await request(app).get("/api/live").expect(200);
  const health = await request(app).get("/api/health").expect(503);
  assert.equal(health.text, "service temporarily unavailable");
  assert.equal(health.headers["retry-after"], "10");
  assert.ok(Date.now() - started < 2000);
});
