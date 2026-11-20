import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { chromium, request } from "playwright";
import { createApp } from "../../backend/src/app.js";
import { initializeDatabase } from "../../backend/src/config/database.js";
import { Player, Settings } from "../../backend/src/models/index.js";
const origin = "http://127.0.0.1:4180";
const env = {
  NODE_ENV: "test",
  JWT_SECRET: randomBytes(40).toString("hex"),
  ADMIN_EMAIL: "corrections@example.test",
  ADMIN_PASSWORD: "Synthetic-corrections-admin123!",
  APP_ORIGIN: origin,
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9UQAAAAASUVORK5CYII=",
  "base64",
);
let db, server, browser, seed;
try {
  await mkdir("test-results/corrections", { recursive: true });
  db = await MongoMemoryServer.create({ binary: { version: "8.0.17" } });
  await mongoose.connect(db.getUri(), { dbName: "synthetic_corrections_test" });
  await initializeDatabase(env);
  const app = createApp({
    env,
    now: () => new Date("2026-11-25T12:00:00+05:30"),
  });
  server = await new Promise((resolve) => {
    const listener = app.listen(4180, "127.0.0.1", () => resolve(listener));
  });
  seed = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  const registered = await seed.post("/api/registrations", {
    multipart: {
      name: "Correction Test Player",
      phone: "9876543210",
      age: "24",
      address: "Synthetic test address only",
      roles: '["Batter"]',
      tshirtSize: "L",
      declaration: "true",
      playerPhoto: { name: "photo.png", mimeType: "image/png", buffer: png },
      paymentProof: { name: "proof.png", mimeType: "image/png", buffer: png },
    },
  });
  assert.equal(registered.status(), 201);
  const before = await Player.findOne({ phone: "9876543210" });
  await seed.post("/api/admin/login", {
    data: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
  });
  assert.equal(
    (
      await seed.patch(`/api/admin/players/${before._id}/decision`, {
        data: {
          status: "rejected",
          reason: "Please replace the unreadable payment screenshot.",
        },
      })
    ).status(),
    200,
  );
  await Settings.updateOne(
    { _id: "tournament" },
    { $set: { registrationMode: "closed" } },
  );
  browser = await chromium.launch({
    channel: process.platform === "win32" ? "msedge" : "chromium",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/#/login");
  await page.getByLabel("Mobile number", { exact: false }).fill("9876543210");
  await page.getByLabel("Password", { exact: false }).fill("9876543210");
  await page
    .getByRole("button", { name: "View my registration", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Correct & resubmit", exact: true })
    .waitFor();
  assert.match(
    await page.locator(".status-hero").innerText(),
    /unreadable payment screenshot/,
  );
  await page
    .getByRole("link", { name: "Correct & resubmit", exact: true })
    .click();
  await page.locator("#name").waitFor();
  assert.equal(
    await page.locator("#name").inputValue(),
    "Correction Test Player",
  );
  assert.equal(await page.locator("#age").inputValue(), "24");
  assert.equal(
    await page.locator("#phone").evaluate((el) => el.readOnly),
    true,
  );
  assert.match(
    await page.locator(".form-content").innerText(),
    /Reason for rejection:.*unreadable payment screenshot/s,
  );
  assert.equal(await page.locator("#password").count(), 0);
  await page.locator("#name").fill("Corrected Test Player");
  await page.locator("#age").fill("25");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert.equal(
    await page.getByLabel("Batter", { exact: true }).isChecked(),
    true,
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText(/No additional registration fee is charged/).waitFor();
  await page
    .getByRole("button", { name: "Continue to payment proof", exact: true })
    .click();
  await page.getByText(/Current payment screenshot/).waitFor();
  await page
    .locator("#paymentProof")
    .setInputFiles({
      name: "corrected-proof.png",
      mimeType: "image/png",
      buffer: png,
    });
  await page.getByRole("checkbox", { name: /I confirm/ }).check();
  await page.screenshot({
    path: "test-results/corrections/form-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page
    .getByRole("button", { name: "Resubmit for verification", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "You’re registered. Review is next.",
      exact: true,
    })
    .waitFor();
  const corrected = await Player.findById(before._id);
  assert.equal(corrected.registrationId, before.registrationId);
  assert.equal(corrected.status, "pending");
  assert.equal(corrected.name, "Corrected Test Player");
  assert.equal(corrected.age, 25);
  assert.equal(corrected.submissionRevision, 1);
  assert.equal(String(corrected.playerPhotoId), String(before.playerPhotoId));
  assert.notEqual(
    String(corrected.paymentProofId),
    String(before.paymentProofId),
  );
  assert.equal(await Player.countDocuments({ phone: "9876543210" }), 1);
  assert.equal(
    await page
      .getByRole("link", { name: "Correct & resubmit", exact: true })
      .count(),
    0,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/corrections/pending-desktop.png",
    fullPage: true,
  });
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const admin = await adminContext.newPage();
  await admin.goto(origin + "/#/admin");
  await admin.getByLabel("Email address").fill(env.ADMIN_EMAIL);
  await admin.getByLabel(/^Password/).fill(env.ADMIN_PASSWORD);
  await admin
    .getByRole("button", { name: "Open admin panel", exact: true })
    .click();
  await admin
    .getByRole("button", { name: "Corrected Test Player", exact: true })
    .click();
  await admin.getByText(/Corrected submission #1/).waitFor();
  await admin.getByRole("checkbox", { name: /I have verified/ }).check();
  await admin
    .getByRole("button", { name: "Approve registration", exact: true })
    .click();
  await admin.getByRole("dialog").waitFor();
  await admin
    .getByRole("button", { name: "No, not right now", exact: true })
    .click();
  assert.equal((await Player.findById(before._id)).status, "approved");
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/corrections/result.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "Rejected dashboard reason and correction link",
          "Prefilled mobile form, immutable sign-in number",
          "Retained photo and replaced proof without another fee",
          "Resubmission after new registration closes",
          "Same registration ID, pending status and one player record",
          "Admin reviews and approves corrected revision",
        ],
        data: "isolated synthetic only",
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: rejected -> prefilled correction -> replace proof -> same ID/pending -> admin reapproval, including closed registration and mobile layout.",
  );
} finally {
  if (browser) await browser.close();
  if (seed) await seed.dispose();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (db) await db.stop();
}
