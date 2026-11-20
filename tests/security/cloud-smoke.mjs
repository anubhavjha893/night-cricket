import fs from "node:fs";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { chromium, request } from "playwright";
import { fileTypeFromBuffer } from "file-type";
const env = dotenv.parse(fs.readFileSync(".env.deploy"));
const base = "https://ugm-cricket-season-2.vercel.app";
const result = {
  checkedAt: new Date().toISOString(),
  base,
  checks: [],
  timings: [],
  label: "verified live: low-volume smoke; no registration or payment writes",
};
fs.mkdirSync("test-results/cloud", { recursive: true });
async function check(name, action) {
  await action();
  result.checks.push({ name, passed: true });
  console.log("PASS " + name);
}
const anon = await request.newContext({ baseURL: base, timeout: 20000 });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.name));
try {
  await check(
    "Public homepage renders and Season 1 photographs load",
    async () => {
      const r = await page.goto(base, { waitUntil: "networkidle" });
      assert.equal(r.status(), 200);
      await page
        .getByRole("heading", { name: /Every player/i })
        .waitFor({ timeout: 1000 })
        .catch(() => {});
      assert.match(
        await page.locator("body").innerText(),
        /URMILA GUPTA MEMORIAL/i,
      );
      for (const name of ["season-1-welcome.webp", "season-1-trophy.webp"])
        assert.equal(
          await page
            .locator(`img[src*="${name}"]`)
            .evaluate((el) => el.complete && el.naturalWidth > 0),
          true,
        );
      await page.screenshot({
        path: "test-results/cloud/home-desktop.png",
        fullPage: true,
      });
    },
  );
  await check("Live readiness, configured payment and QR image", async () => {
    for (const path of ["/api/ready", "/api/config", "/api/payment/qr"]) {
      const start = performance.now();
      const r = await anon.get(path);
      result.timings.push({
        path,
        status: r.status(),
        elapsedMs: Math.round(performance.now() - start),
      });
      assert.equal(r.status(), 200);
      assert.match(r.headers()["cache-control"], /no-store/);
      if (path.endsWith("/config")) {
        const c = await r.json();
        // Payment details are mutable organiser settings, not deployment constants.
        assert.equal(c.payment.configured, true);
        assert.equal(typeof c.payment.payeeName, "string");
        assert(c.payment.uploadedQr || c.payment.upiId?.includes("@"));
        assert.equal(c.fee, 150);
        assert.equal(typeof c.registration.isOpen, "boolean");
        result.registration = c.registration;
      }
      if (path.endsWith("/qr")) {
        const format = await fileTypeFromBuffer(await r.body());
        assert(
          ["image/png", "image/jpeg", "image/webp"].includes(format?.mime),
        );
        assert(r.headers()["content-type"].startsWith(format.mime));
      }
    }
  });
  await check("Anonymous admin access is rejected", async () =>
    assert.equal((await anon.get("/api/admin/players")).status(), 401),
  );
  await check("Health endpoints return only health is good", async () => {
    for (const path of ["/health", "/api/health"]) {
      const response = await anon.get(path);
      assert.equal(response.status(), 200);
      assert.equal(await response.text(), "health is good");
      assert.match(response.headers()["content-type"], /text\/plain/);
    }
  });
  await check(
    "Admin uses email; login cookie survives Vercel-to-Render proxy",
    async () => {
      await page.goto(base + "/#/admin", { waitUntil: "networkidle" });
      await page.locator("#admin-email").fill(env.ADMIN_EMAIL);
      await page.locator("#admin-password").fill(env.ADMIN_PASSWORD);
      await page.getByRole("button", { name: "Open admin panel" }).click();
      await page
        .getByRole("button", { name: "Player registrations", exact: true })
        .waitFor({ timeout: 20000 });
      assert.equal(
        (await context.request.get(base + "/api/auth/me")).status(),
        200,
      );
      const cookie = (await context.cookies()).find(
        (c) => c.name === "ugm_session",
      );
      assert(cookie);
      assert(cookie.secure && cookie.httpOnly);
      assert.equal(cookie.sameSite, "Lax");
    },
  );
  const cookie = (await context.cookies()).find(
    (c) => c.name === "ugm_session",
  );
  await check(
    "Admin can read applications/settings; cross-site changes rejected",
    async () => {
      assert.equal(
        (await context.request.get(base + "/api/admin/players")).status(),
        200,
      );
      assert.equal(
        (await context.request.get(base + "/api/admin/settings")).status(),
        200,
      );
      assert.equal(
        (
          await context.request.post(base + "/api/auth/logout", {
            headers: { Origin: "https://untrusted.example" },
          })
        ).status(),
        403,
      );
      const r = await context.request.get(base + "/api/admin/metrics");
      assert.equal(r.status(), 200);
      result.serverMetrics = await r.json();
    },
  );
  await check("UI logout revokes the captured session", async () => {
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page
      .getByRole("heading", { name: "Admin sign in", exact: true })
      .waitFor();
    assert.equal(
      (
        await anon.get("/api/auth/me", {
          headers: { Cookie: `ugm_session=${cookie.value}` },
        })
      ).status(),
      401,
    );
  });
  await check(
    "Mobile homepage and registration availability render without JS errors",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(base, { waitUntil: "networkidle" });
      assert(
        await page
          .locator("body")
          .evaluate((el) => el.scrollWidth <= window.innerWidth),
      );
      await page.screenshot({
        path: "test-results/cloud/home-mobile.png",
        fullPage: true,
      });
      await page.goto(base + "/#/register", { waitUntil: "networkidle" });
      await page.locator("#phone").waitFor({ timeout: 15000 });
      if (!result.registration.isOpen)
        assert.match(
          await page.locator("body").innerText(),
          /not yet|opens|closed/i,
        );
      await page
        .getByLabel("Mobile number", { exact: false })
        .fill("9876543210");
      assert.equal(await page.locator("#password").inputValue(), "9876543210");
      assert.equal(
        await page.locator("#password").evaluate((el) => el.readOnly),
        true,
      );
      assert.equal(await page.locator("#transactionReference").count(), 0);
      assert.deepEqual(errors, []);
    },
  );
  result.passed = true;
} catch (e) {
  result.passed = false;
  result.failure = {
    type: e.name,
    message: e.message
      .replaceAll(env.ADMIN_EMAIL, "[redacted]")
      .replaceAll(env.ADMIN_PASSWORD, "[redacted]"),
  };
  process.exitCode = 1;
  console.log("Smoke failed: " + e.name);
} finally {
  await browser.close();
  await anon.dispose();
  fs.writeFileSync(
    "test-results/cloud/smoke.json",
    JSON.stringify(result, null, 2),
  );
}
