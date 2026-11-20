import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "node:crypto";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import { createApp } from "../../backend/src/app.js";
import { initializeDatabase } from "../../backend/src/config/database.js";

// ISOLATED ONLY: creates its own mongod and loopback server. No live URL or .env.
// Caps: 20 journeys at 1/sec, 100 QR reads at 10/sec; at most 4 in flight,
// 400 total requests, 90 seconds. Stop on 3 server errors, RSS >512MiB or timeout.
const label = process.argv[2];
if (!["baseline", "after"].includes(label))
  throw new Error("Use baseline or after.");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const percentile = (values) =>
  values.length
    ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1]
    : 0;
const env = {
  NODE_ENV: "test",
  JWT_SECRET: randomBytes(40).toString("hex"),
  ADMIN_EMAIL: "load@example.test",
  ADMIN_PASSWORD: "Synthetic-load-admin-123!",
  APP_ORIGIN: "http://localhost:5173",
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9UQAAAAASUVORK5CYII=",
  "base64",
);
let db,
  server,
  origin,
  total = 0,
  failures = 0,
  peakRss = 0,
  pool = 0,
  peakPool = 0;
const started = performance.now();
const loop = monitorEventLoopDelay({ resolution: 20 });
loop.enable();
const samples = [];
const memory = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 100);
async function call(path, { method = "GET", body, cookie } = {}) {
  if (
    ++total > 400 ||
    performance.now() - started > 90000 ||
    failures >= 3 ||
    peakRss > 512 * 1024 * 1024
  )
    throw new Error("Safety stop condition reached.");
  const at = performance.now();
  const response = await fetch(origin + path, {
    method,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    headers: {
      Origin: env.APP_ORIGIN,
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    signal: AbortSignal.timeout(5000),
  });
  const bytes = await response.arrayBuffer();
  const row = {
    route: path.replace(/\/players\/[a-f0-9]{24}/g, "/players/:id"),
    status: response.status,
    ms: performance.now() - at,
  };
  samples.push(row);
  if (response.status >= 500) failures++;
  let json;
  try {
    json = JSON.parse(Buffer.from(bytes).toString());
  } catch {}
  return {
    status: response.status,
    json,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
function summary(rows, duration, flow) {
  return {
    requests: rows.length,
    throughputRps: +(rows.length / duration).toFixed(2),
    p95Ms: +percentile(rows.map((v) => v.ms)).toFixed(2),
    serverErrors: rows.filter((v) => v.status >= 500).length,
    rateLimited: rows.filter((v) => v.status === 429).length,
    ...flow,
  };
}
try {
  db = await MongoMemoryServer.create({ binary: { version: "8.0.17" } });
  await mongoose.connect(db.getUri(), {
    dbName: "isolated_security_load",
    maxPoolSize: 20,
    waitQueueTimeoutMS: 2000,
    serverSelectionTimeoutMS: 2000,
    socketTimeoutMS: 5000,
  });
  const client = mongoose.connection.getClient();
  client.on("connectionCheckedOut", () => {
    pool++;
    peakPool = Math.max(peakPool, pool);
  });
  client.on("connectionCheckedIn", () => pool--);
  await initializeDatabase(env);
  const app = createApp({
    env,
    now: () => new Date("2026-11-25T12:00:00+05:30"),
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const admin = await call("/api/admin/login", {
    method: "POST",
    body: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
  });
  if (admin.status !== 200) throw new Error("Synthetic admin setup failed.");
  let succeeded = 0;
  const journeyStart = performance.now(),
    first = samples.length;
  const active = new Set();
  async function journey(index) {
    const form = new FormData();
    const fields = {
      name: `Synthetic Player ${index}`,
      age: "24",
      phone: `98888${String(index).padStart(5, "0")}`,
      password: "Synthetic-player-pass123!",
      address: "Synthetic fixture address, test only",
      roles: JSON.stringify(["Batter"]),
      tshirtSize: "L",
      transactionReference: `LOADTEST${String(index).padStart(6, "0")}`,
      declaration: "true",
    };
    Object.entries(fields).forEach(([k, v]) => form.set(k, v));
    form.set(
      "playerPhoto",
      new Blob([png], { type: "image/png" }),
      "photo.png",
    );
    form.set(
      "paymentProof",
      new Blob([png], { type: "image/png" }),
      "proof.png",
    );
    const created = await call("/api/registrations", {
      method: "POST",
      body: form,
    });
    if (created.status !== 201) return;
    const profile = await call("/api/player/me", { cookie: created.cookie });
    if (profile.status !== 200) return;
    const list = await call("/api/admin/players?status=pending", {
      cookie: admin.cookie,
    });
    if (list.status !== 200) return;
    const details = await call(`/api/admin/players/${profile.json._id}`, {
      cookie: admin.cookie,
    });
    if (details.status !== 200) return;
    const review = await call(
      `/api/admin/players/${profile.json._id}/decision`,
      { method: "PATCH", cookie: admin.cookie, body: { status: "approved" } },
    );
    if (review.status !== 200) return;
    const updated = await call("/api/player/me", { cookie: created.cookie });
    if (
      updated.json?.status !== "approved" ||
      !updated.json.notifications.some((n) => n.kind === "approved")
    )
      return;
    const logout = await call("/api/auth/logout", {
      method: "POST",
      cookie: created.cookie,
    });
    if (logout.status === 200) succeeded++;
  }
  for (let i = 1; i <= 20; i++) {
    const due = journeyStart + (i - 1) * 1000;
    await sleep(Math.max(0, due - performance.now()));
    if (active.size >= 2) await Promise.race(active);
    const task = journey(i);
    active.add(task);
    task.finally(() => active.delete(task));
  }
  await Promise.all(active);
  const journeyResult = summary(
    samples.slice(first),
    (performance.now() - journeyStart) / 1000,
    {
      attemptedJourneys: 20,
      successfulJourneys: succeeded,
      flowSuccessPct: succeeded * 5,
    },
  );
  const qrStart = performance.now(),
    qrFirst = samples.length;
  for (let i = 0; i < 100; i++) {
    await sleep(Math.max(0, qrStart + i * 100 - performance.now()));
    if (active.size >= 4) await Promise.race(active);
    const task = call("/api/payment/qr");
    active.add(task);
    task.finally(() => active.delete(task));
  }
  await Promise.all(active);
  const qrResult = summary(
    samples.slice(qrFirst),
    (performance.now() - qrStart) / 1000,
  );
  // Safe, local-only reproduction of logout-token replay and parser disclosure.
  const replayLogin = await call("/api/admin/login", {
    method: "POST",
    body: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
  });
  await call("/api/auth/logout", {
    method: "POST",
    cookie: replayLogin.cookie,
  });
  const replay = await call("/api/auth/me", { cookie: replayLogin.cookie });
  const malformed = await fetch(origin + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: env.APP_ORIGIN },
    body: "SYNTHETIC_SECRET_MARKER",
  });
  const parserDisclosure = (await malformed.text()).includes(
    "SYNTHETIC_SECRET_MARKER",
  );
  const result = {
    label,
    commit: process.env.AUDIT_BASELINE_COMMIT || "see git provenance",
    environment: "isolated local MongoDB, no payment/provider calls",
    caps: {
      journeys: 20,
      journeysPerSecond: 1,
      qrReads: 100,
      qrPerSecond: 10,
      maxConcurrent: 4,
      totalRequestCap: 400,
      timeoutSeconds: 90,
      stopAfterServerErrors: 3,
      rssStopMiB: 512,
    },
    journeys: journeyResult,
    qr: qrResult,
    probes: {
      replayedCookieStatus: replay.status,
      parserDisclosedBody: parserDisclosure,
    },
    resources: {
      peakRssMiB: +(peakRss / 1024 / 1024).toFixed(1),
      eventLoopP95Ms: +(loop.percentile(95) / 1e6).toFixed(2),
      maxCheckedOutDatabaseConnections: peakPool,
      databaseCpuAndQueue: "not instrumented; no saturation claim",
    },
    seconds: +((performance.now() - started) / 1000).toFixed(2),
  };
  await mkdir("test-results/security", { recursive: true });
  await writeFile(
    `test-results/security/${label}.json`,
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  clearInterval(memory);
  loop.disable();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (db) await db.stop();
}
