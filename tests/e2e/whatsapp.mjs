import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { chromium, request } from "playwright";
import { createApp } from "../../backend/src/app.js";
import { initializeDatabase } from "../../backend/src/config/database.js";
import { Player, Settings } from "../../backend/src/models/index.js";

const origin = "http://127.0.0.1:4179";
const env = {
  NODE_ENV: "test",
  JWT_SECRET: randomBytes(40).toString("hex"),
  ADMIN_EMAIL: "whatsapp-admin@example.test",
  ADMIN_PASSWORD: "Synthetic-whatsapp-admin123!",
  APP_ORIGIN: origin,
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9UQAAAAASUVORK5CYII=",
  "base64",
);
let db, server, browser, seed;
const checks = [],
  errors = [];
async function pass(name) {
  checks.push(name);
  console.log("PASS " + name);
}
try {
  await mkdir("test-results/whatsapp", { recursive: true });
  db = await MongoMemoryServer.create({ binary: { version: "8.0.17" } });
  await mongoose.connect(db.getUri(), { dbName: "synthetic_whatsapp_test" });
  await initializeDatabase(env);
  const app = createApp({
    env,
    now: () => new Date("2026-11-25T12:00:00+05:30"),
  });
  server = await new Promise((resolve) => {
    const listener = app.listen(4179, "127.0.0.1", () => resolve(listener));
  });
  seed = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  for (const [name, phone] of [
    ["Asha Approval Player", "9876543210"],
    ["Ravi Rejection Player", "9765432109"],
    ["Invalid Phone Player", "9654321098"],
  ]) {
    const r = await seed.post("/api/registrations", {
      multipart: {
        name,
        phone,
        age: "24",
        address: "Synthetic test address only",
        roles: '["Batter"]',
        tshirtSize: "L",
        declaration: "true",
        playerPhoto: { name: "photo.png", mimeType: "image/png", buffer: png },
        paymentProof: { name: "proof.png", mimeType: "image/png", buffer: png },
      },
    });
    assert.equal(r.status(), 201);
  }
  await Player.updateOne(
    { name: "Asha Approval Player" },
    { $set: { phone: "+91 98765-43210" } },
  );
  await Player.updateOne(
    { name: "Invalid Phone Player" },
    { $set: { phone: "12345" } },
  );
  browser = await chromium.launch({
    channel: process.platform === "win32" ? "msedge" : "chromium",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  let chatNavigations = 0;
  await context.route("https://wa.me/**", async (route) => {
    chatNavigations++;
    await route.fulfill({
      contentType: "text/html",
      body: "<title>WhatsApp test stub</title><p>Synthetic chat only. No message sent.</p>",
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/#/admin");
  await page.getByLabel("Email address").fill(env.ADMIN_EMAIL);
  await page.getByLabel(/^Password/).fill(env.ADMIN_PASSWORD);
  await page
    .getByRole("button", { name: "Open admin panel", exact: true })
    .click();
  const rowMessage = page.getByRole("button", {
    name: "Send WhatsApp message to Asha Approval Player",
    exact: true,
  });
  await rowMessage.click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Registration Approved", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector(".whatsapp-message-preview")
      ?.textContent.includes("Jald announce ki jayegi"),
  );
  assert.equal(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
    true,
  );
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
      true,
    );
  }
  assert.match(
    await dialog.evaluate(
      (el) => getComputedStyle(el, "::backdrop").backdropFilter,
    ),
    /blur/,
  );
  assert.equal(chatNavigations, 0);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(
    await rowMessage.evaluate((el) => document.activeElement === el),
    true,
  );
  assert.equal(
    (await Player.findOne({ name: "Asha Approval Player" })).status,
    "pending",
  );
  await pass(
    "Row options, unset date, focus trap, blurred backdrop and Escape restore; no sending or decision",
  );

  await page
    .getByRole("button", { name: "Payment & settings", exact: true })
    .click();
  await page.getByLabel("Auction date", { exact: true }).fill("2026-12-23");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page
    .getByText("Payment and registration settings saved.", { exact: true })
    .waitFor();
  assert.equal(
    (await Settings.findById("tournament")).auctionDate,
    "2026-12-23",
  );
  await page
    .getByRole("button", { name: "Player registrations", exact: true })
    .click();
  await rowMessage.click();
  await dialog
    .getByRole("button", { name: "Registration Approved", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector(".whatsapp-message-preview")
      ?.textContent.includes("23 December 2026"),
  );
  await page.screenshot({
    path: "test-results/whatsapp/approval-desktop.png",
    fullPage: true,
  });
  const approvalHref = await dialog
    .getByRole("link", { name: "Open WhatsApp", exact: true })
    .getAttribute("href");
  assert.equal(new URL(approvalHref).pathname, "/919876543210");
  assert.match(
    new URL(approvalHref).searchParams.get("text"),
    /Asha Approval Player/,
  );
  assert.match(
    new URL(approvalHref).searchParams.get("text"),
    /Urmila Gupta Memorial Cricket Tournament.*Season 2/,
  );
  assert.equal(chatNavigations, 0);
  await dialog
    .getByRole("button", { name: "No, not right now", exact: true })
    .click();
  await pass(
    "Saved auction date appears in approval draft; existing +91 is not duplicated",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", {
      name: "Send WhatsApp message to Ravi Rejection Player",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", { name: "Registration Rejected", exact: true })
    .click();
  assert.match(
    await page.locator(".whatsapp-message-preview").innerText(),
    /readable payment screenshot/,
  );
  assert.equal(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "test-results/whatsapp/rejection-mobile.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "No, not right now", exact: true })
    .click();
  assert.equal(
    (await Player.findOne({ name: "Ravi Rejection Player" })).status,
    "pending",
  );
  await page
    .getByRole("button", {
      name: "Send WhatsApp message to Invalid Phone Player",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("alert")
    .filter({ hasText: /Invalid mobile number/ })
    .waitFor();
  assert.equal(
    await dialog
      .getByRole("link", { name: "Open WhatsApp", exact: true })
      .count(),
    0,
  );
  await dialog
    .getByRole("button", { name: "No, not right now", exact: true })
    .click();
  await pass(
    "Mobile rejection draft, cancellation, and clear invalid-number error without a chat link",
  );

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Asha Approval Player", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /I have verified/ }).check();
  await page
    .getByRole("button", { name: "Approve registration", exact: true })
    .click();
  await dialog
    .getByRole("heading", {
      name: "Send approval message on WhatsApp?",
      exact: true,
    })
    .waitFor();
  await dialog
    .getByRole("link", { name: "Open WhatsApp", exact: true })
    .waitFor();
  assert.equal(
    (await Player.findOne({ name: "Asha Approval Player" })).status,
    "approved",
  );
  assert.equal(chatNavigations, 0);
  const popupPromise = context.waitForEvent("page");
  await dialog
    .getByRole("link", { name: "Open WhatsApp", exact: true })
    .click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  assert.equal(popup.url(), approvalHref);
  assert.equal(chatNavigations, 1);
  await popup.close();
  assert.equal(await dialog.isVisible(), true);
  assert.match(await dialog.innerText(), /not a sent or delivery confirmation/);
  await dialog
    .getByRole("button", { name: "No, not right now", exact: true })
    .click();
  assert.equal(
    (await Player.findOne({ name: "Asha Approval Player" })).notifications
      .length,
    2,
  );
  await pass(
    "Successful approval offers optional popup; explicit Open WhatsApp opens one stubbed chat, never marks sent",
  );

  await page
    .getByRole("button", { name: "Ravi Rejection Player", exact: true })
    .click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page
    .getByLabel("Reason for rejection", { exact: false })
    .fill("Payment could not be verified.");
  await page
    .getByRole("button", { name: "Confirm rejection", exact: true })
    .click();
  await dialog
    .getByRole("heading", {
      name: "Send rejection message on WhatsApp?",
      exact: true,
    })
    .waitFor();
  assert.match(
    await page.locator(".whatsapp-message-preview").innerText(),
    /payment receive\/verify nahi hua/,
  );
  await dialog
    .getByRole("button", { name: "No, not right now", exact: true })
    .click();
  assert.equal(
    (await Player.findOne({ name: "Ravi Rejection Player" })).status,
    "rejected",
  );
  assert.equal(chatNavigations, 1);
  await pass(
    "Successful rejection offers matching correction message; skip keeps saved rejection and sends nothing",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/whatsapp/result.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        externalWhatsAppRequests: 0,
        stubbedChatsOpened: chatNavigations,
        data: "isolated synthetic only",
      },
      null,
      2,
    ),
  );
} finally {
  if (browser) await browser.close();
  if (seed) await seed.dispose();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (db) await db.stop();
}
