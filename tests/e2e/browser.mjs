import { chromium } from "playwright";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createApp } from "../../backend/src/app.js";
import { initializeDatabase } from "../../backend/src/config/database.js";
import { Settings } from "../../backend/src/models/index.js";

const origin = "http://127.0.0.1:4178";
const env = {
  NODE_ENV: "test",
  JWT_SECRET: randomBytes(40).toString("hex"),
  ADMIN_EMAIL: "browser-admin@example.test",
  ADMIN_PASSWORD: "Browser-admin-test123!",
  APP_ORIGIN: origin,
};
let db, server, browser;
const errors = [];
try {
  db = await MongoMemoryServer.create({ binary: { version: "8.0.17" } });
  await mongoose.connect(db.getUri(), { dbName: "ugm_browser_test" });
  await initializeDatabase(env);
  const app = createApp({
    env,
    now: () => new Date("2026-11-25T12:00:00+05:30"),
  });
  server = await new Promise((resolve) => {
    const listener = app.listen(4178, "127.0.0.1", () => resolve(listener));
  });
  browser = await chromium.launch({
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "win32" ? "msedge" : "chromium"),
    headless: true,
  });
  const playerContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await playerContext.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir("test-results", { recursive: true });
  await page.goto(origin);
  await page.getByRole("heading", { name: /FOR THE LOVE/ }).waitFor();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("link", { name: "Register as a player", exact: true })
    .click();
  await page
    .getByLabel("Full name", { exact: false })
    .fill("Browser Test Player");
  await page.getByLabel(/^Age/).fill("24");
  await page.getByLabel("Mobile number", { exact: false }).fill("9876543210");
  await page
    .getByLabel("Full address", { exact: false })
    .fill("Tenughat Jail Road, Bokaro, Jharkhand Block Seven");
  assert.equal(await page.locator("#password").inputValue(), "9876543210");
  assert.equal(
    await page.locator("#password").evaluate((el) => el.readOnly),
    true,
  );
  await page.getByLabel("Mobile number", { exact: false }).fill("9876543211");
  assert.equal(await page.locator("#password").inputValue(), "9876543211");
  await page.getByLabel("Mobile number", { exact: false }).fill("9876543210");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Batter", { exact: true }).check();
  await page.getByRole("radio", { name: "L", exact: true }).check();
  await page
    .locator("#playerPhoto")
    .setInputFiles("frontend/public/assets/night-stadium.jpg");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("heading", { name: "Registration payment", exact: true })
    .waitFor();
  await page.locator(".qr-frame img").waitFor();
  assert.equal(
    await page.locator(".payment-card h3").textContent(),
    "Anubhav Jha",
  );
  assert.match(
    await page.locator(".copy-upi").textContent(),
    /8210708838sbi@axl/,
  );
  await page.screenshot({
    path: "test-results/payment-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/payment-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Mobile payment page must not overflow horizontally",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  const testReceipt = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 700;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f3f6ef";
    ctx.fillRect(0, 0, 700, 500);
    ctx.fillStyle = "#1a3222";
    ctx.font = "bold 28px Arial";
    ctx.fillText("LOCAL TEST — NO REAL PAYMENT", 40, 70);
    ctx.font = "22px Arial";
    ctx.fillText("Amount: INR 150", 40, 150);
    ctx.fillText("Recipient: Anubhav Jha", 40, 205);
    ctx.fillText("UPI: 8210708838sbi@axl", 40, 260);
    ctx.fillText("UTR: BROWSERTEST123456", 40, 315);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByRole("button", { name: /I’ve paid/ }).click();
  await page.locator("#paymentProof").setInputFiles({
    name: "local-test-receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(testReceipt, "base64"),
  });
  assert.equal(await page.locator("#transactionReference").count(), 0);
  await page.getByRole("checkbox", { name: /I confirm/ }).check();
  await page
    .getByRole("button", { name: "Submit registration", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "You’re registered. Review is next.",
      exact: true,
    })
    .waitFor();
  await page.screenshot({
    path: "test-results/player-pending.png",
    fullPage: true,
    animations: "disabled",
  });
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const admin = await adminContext.newPage();
  let adminPosterTemplateRequests = 0;
  admin.on("request", (request) => {
    if (request.url().endsWith("/assets/participation-template.webp"))
      adminPosterTemplateRequests++;
  });
  admin.on("pageerror", (error) => errors.push(error.message));
  await admin.goto(`${origin}/#/admin`);
  await admin.getByLabel("Email address").fill(env.ADMIN_EMAIL);
  await admin.getByLabel(/^Password/).fill(env.ADMIN_PASSWORD);
  await admin
    .getByRole("button", { name: "Open admin panel", exact: true })
    .click();
  await admin
    .getByRole("button", { name: "Player registrations", exact: true })
    .click();
  await admin
    .getByRole("button", { name: "Browser Test Player", exact: true })
    .click();
  await admin.getByText("Payment verification", { exact: false }).waitFor();
  await admin.locator(".payment-proof img").waitFor();
  const poster = page.getByRole("img", {
    name: /BROWSER TEST PLAYER, BATTER, Tenughat Jail Road, Bokaro, Jharkhand\./,
  });
  await poster.waitFor();
  const originalPhoto = await admin
    .locator(".review-photo img")
    .getAttribute("src");
  const replacement = await sharp({
    create: { width: 220, height: 800, channels: 3, background: "#408060" },
  })
    .png()
    .toBuffer();
  await page.getByRole("button", { name: "Change photo" }).click();
  await page.locator("#replacement-photo").setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: replacement,
  });
  await page.getByRole("button", { name: "Save photo" }).click();
  await page.getByText("Photo updated.", { exact: true }).waitFor();
  await admin.waitForFunction((oldUrl) => {
    const img = document.querySelector(".review-photo img");
    return img?.complete && img.naturalHeight === 800 && img.src !== oldUrl;
  }, originalPhoto);
  assert.equal(
    adminPosterTemplateRequests,
    0,
    "Admin poster artwork must stay lazy until the poster is opened",
  );
  await admin
    .getByRole("button", { name: "View registration poster", exact: true })
    .click();
  const adminPosterDialog = admin.getByRole("dialog", {
    name: "Browser Test Player",
  });
  await adminPosterDialog.waitFor();
  const adminPoster = adminPosterDialog.getByRole("img", {
    name: /BROWSER TEST PLAYER, BATTER, Tenughat Jail Road, Bokaro, Jharkhand\./,
  });
  await adminPoster.waitFor();
  assert.equal(adminPosterTemplateRequests, 1);
  const adminDownloadEvent = admin.waitForEvent("download");
  await adminPosterDialog
    .getByRole("button", { name: "Download poster", exact: true })
    .click();
  const adminDownload = await adminDownloadEvent;
  assert.match(
    adminDownload.suggestedFilename(),
    /^UGM2-[A-F0-9]+-player-poster\.png$/,
  );
  const adminPosterFile = await adminDownload.path();
  const adminPosterMeta = await sharp(adminPosterFile).metadata();
  assert.deepEqual(
    [adminPosterMeta.format, adminPosterMeta.width, adminPosterMeta.height],
    ["png", 1024, 1536],
  );
  await admin.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await adminPosterDialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
    true,
  );
  await admin.screenshot({
    path: "test-results/admin-poster-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await admin.setViewportSize({ width: 1440, height: 1000 });
  await adminPosterDialog
    .getByRole("button", { name: "Close registration poster", exact: true })
    .click();
  await adminPosterDialog.waitFor({ state: "detached" });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download poster" }).click();
  const download = await downloadEvent;
  const posterFile = await download.path();
  const meta = await sharp(posterFile).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ["png", 1024, 1536]);
  const [adminPosterPixels, playerPosterPixels] = await Promise.all([
    sharp(adminPosterFile).ensureAlpha().raw().toBuffer(),
    sharp(posterFile).ensureAlpha().raw().toBuffer(),
  ]);
  assert.equal(
    adminPosterPixels.equals(playerPosterPixels),
    true,
    "Admin and player downloads must render the exact same poster pixels",
  );
  for (const [x, y] of [
    [260, 282],
    [764, 926],
  ]) {
    const pixel = await sharp(posterFile)
      .extract({ left: x, top: y, width: 1, height: 1 })
      .raw()
      .toBuffer();
    assert.deepEqual([...pixel.subarray(0, 3)], [64, 128, 96]);
  }
  await page.goto(origin);
  const homePoster = page.getByRole("link", {
    name: "View or edit your player poster",
  });
  await homePoster.getByRole("img").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok((await homePoster.boundingBox()).width < 150);
  await homePoster.click();
  await poster.waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await admin.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.screenshot({
    path: "test-results/admin-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await admin.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Mobile admin must not overflow horizontally",
  );
  await admin.getByRole("checkbox", { name: /I have verified/ }).check();
  await admin
    .getByRole("button", { name: "Approve registration", exact: true })
    .click();
  await admin.getByRole("dialog").waitFor();
  await admin
    .getByRole("button", { name: "No, not right now", exact: true })
    .click();
  await admin
    .getByText("Player details and payment approved.", { exact: false })
    .waitFor();
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "You’re verified. Get ready.", exact: true })
    .waitFor();
  await page.getByText(/Congratulations, Browser Test Player!/).waitFor();
  await page.screenshot({
    path: "test-results/player-approved.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Mark all read" }).click();
  await page.locator(".notification-count").waitFor({ state: "hidden" });
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Synthetic unavailable response" }),
    }),
  );
  await page.getByRole("button", { name: /Sign out/ }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Sign out could not be completed" })
    .waitFor();
  await page
    .getByRole("heading", { name: "You’re verified. Get ready." })
    .waitFor();
  await page.unroute("**/api/auth/logout");
  const realLogout = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/logout"),
  );
  await page.getByRole("button", { name: /Sign out/ }).click();
  const logoutResponse = await realLogout;
  assert.equal(
    logoutResponse.status(),
    200,
    `Logout failed: ${await logoutResponse.text()}`,
  );
  await page.getByLabel(/^Mobile number/).fill("9876543210");
  await page.getByLabel(/^Password/).fill("9876543210");
  await page
    .getByRole("button", { name: "View my registration", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "You’re verified. Get ready." })
    .waitFor();
  // Exercise the uploaded-QR path and check that the payment page uses that image.
  await admin.setViewportSize({ width: 1440, height: 1000 });
  await admin.getByRole("button", { name: "Payment & settings" }).click();
  await admin
    .locator("#paymentQr")
    .setInputFiles("frontend/public/assets/night-stadium.jpg");
  await admin.locator("#upiId").fill("");
  await admin.getByRole("button", { name: "Save settings" }).click();
  await admin
    .getByText("Payment and registration settings saved.", { exact: true })
    .waitFor();
  assert.equal(Boolean((await Settings.findById("tournament")).qrFileId), true);
  const newcomer = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const registration = await newcomer.newPage();
  registration.on("pageerror", (error) => errors.push(error.message));
  await registration.goto(`${origin}/#/register`);
  await registration
    .getByLabel("Full name", { exact: false })
    .fill("Synthetic QR Check");
  await registration.getByLabel(/^Age/).fill("23");
  await registration.getByLabel(/^Mobile number/).fill("9765432109");
  await registration
    .getByLabel(/^Full address/)
    .fill("Synthetic test address only");
  assert.equal(
    await registration.locator("#password").inputValue(),
    "9765432109",
  );
  await registration
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await registration.getByLabel("Batter", { exact: true }).check();
  await registration.getByRole("radio", { name: "L", exact: true }).check();
  await registration
    .locator("#playerPhoto")
    .setInputFiles("frontend/public/assets/night-stadium.jpg");
  await registration
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await registration.locator(".qr-frame img").waitFor();
  await registration
    .locator(".qr-frame img")
    .evaluate((image) => image.decode());
  assert.match(
    await registration.locator(".qr-frame img").getAttribute("src"),
    /\/api\/payment\/qr$/,
  );
  assert.equal(
    await registration
      .locator(".qr-frame img")
      .evaluate((image) => image.naturalWidth > 0),
    true,
  );
  await newcomer.close();
  assert.deepEqual(errors, [], "No browser JavaScript errors");
  console.log(
    "PASS: desktop/mobile registration, uploads, pending, admin approval/notification, logout failure recovery, re-login and custom QR without a UPI ID.",
  );
  console.log(
    "Screenshots saved to test-results/. All data was isolated test data; no real payment or live submission was made.",
  );
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (db) await db.stop();
}
