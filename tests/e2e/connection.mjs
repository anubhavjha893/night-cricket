import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import express from "express";
import { chromium } from "playwright";
const app = express();
app.use(express.static("frontend/dist"));
const server = await new Promise((resolve) => {
  const s = app.listen(4181, "127.0.0.1", () => resolve(s));
});
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "msedge" : "chromium",
  headless: true,
});
const config = {
  name: "Synthetic Tournament",
  season: 2,
  fee: 150,
  venue: "Synthetic Ground",
  registration: { isOpen: true, message: "Registration open" },
  payment: {
    configured: true,
    payeeName: "Synthetic Recipient",
    upiId: "test@bank",
    amount: 150,
    qrUrl: "/api/payment/qr",
  },
};
const checks = [];
try {
  await mkdir("test-results/connection", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  let release,
    mode = "slow",
    auth = "signedout";
  const gate = new Promise((resolve) => (release = resolve));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/config", async (route) => {
    if (mode === "slow") await gate;
    if (mode === "failed")
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: '{"message":"Synthetic configuration failure"}',
      });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(config),
    });
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: auth === "failed" ? 403 : 401,
      contentType: "application/json",
      body: '{"message":"Synthetic session response"}',
    }),
  );
  await page.goto("http://127.0.0.1:4181/#/register", {
    waitUntil: "domcontentloaded",
  });
  assert.equal(await page.locator("#name").count(), 0);
  const screen = page.getByRole("dialog", {
    name: "Getting things ready.",
    exact: true,
  });
  await screen.waitFor();
  assert.match(
    await screen.innerText(),
    /first connection may take up to a minute/,
  );
  assert.equal(
    await screen.evaluate((el) => el.contains(document.activeElement)),
    true,
  );
  assert.equal(
    await screen.evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
  );
  await page.screenshot({
    path: "test-results/connection/waiting-mobile.png",
    fullPage: true,
  });
  release();
  await screen.waitFor({ state: "hidden" });
  await page.locator("#name").waitFor();
  checks.push(
    "Registration fields appear only after availability is confirmed",
  );
  for (const phase of ["upcoming", "closed"]) {
    config.registration = {
      isOpen: false,
      phase,
      message: "Registration unavailable",
    };
    config.opensAt = "2026-11-24T00:00:00+05:30";
    await page.reload();
    await page
      .getByRole("heading", {
        name:
          phase === "upcoming"
            ? "Registration opens soon."
            : "Registration closed.",
      })
      .waitFor();
    if (phase === "upcoming")
      await page.getByText("24 November 2026").waitFor();
    assert.equal(await page.locator('a[href="tel:+918825170314"]').count(), 1);
    assert.equal(await page.locator("#name").count(), 0);
  }
  config.registration = { isOpen: true, message: "Registration open" };
  mode = "failed";
  await page.reload({ waitUntil: "domcontentloaded" });
  const failed = page.getByRole("dialog", {
    name: "Unable to connect right now.",
    exact: true,
  });
  await failed.waitFor();
  assert.equal(
    await failed
      .getByRole("button", { name: "Retry connection", exact: true })
      .isEnabled(),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/connection/retry-desktop.png",
    fullPage: true,
  });
  mode = "healthy";
  await failed
    .getByRole("button", { name: "Retry connection", exact: true })
    .click();
  await failed.waitFor({ state: "hidden" });
  await page.locator("#name").waitFor();
  checks.push(
    "Failed startup shows accessible retry screen and a successful retry restores the page",
  );
  auth = "failed";
  await page.reload({ waitUntil: "domcontentloaded" });
  await failed.waitFor();
  auth = "signedout";
  await failed
    .getByRole("button", { name: "Retry connection", exact: true })
    .click();
  await failed.waitFor({ state: "hidden" });
  await page.locator("#name").waitFor();
  checks.push(
    "Session verification failure is not mistaken for a completed startup; ordinary signed-out 401 is accepted",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/connection/result.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        data: "synthetic HTTP stubs only; no host or DB failure simulated live",
      },
      null,
      2,
    ),
  );
  checks.forEach((c) => console.log("PASS " + c));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
