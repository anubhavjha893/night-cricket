import fs from "node:fs";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { chromium, request } from "playwright";
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
      for (const name of ["season-1-welcome.png", "season-1-trophy.png"])
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
  await check("Live readiness, payment configuration and PNG QR", async () => {
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
        assert.equal(c.payment.payeeName, "Anubhav Jha");
        assert.equal(c.payment.upiId, "8210708838sbi@axl");
        assert.equal(c.fee, 150);
        assert.equal(c.registration.isOpen, false);
        result.registration = c.registration;
      }
      if (path.endsWith("/qr")) {
        assert.match(r.headers()["content-type"], /image\/png/);
        assert.equal((await r.body()).subarray(1, 4).toString(), "PNG");
      }
    }
  });
  await check("Anonymous admin access is rejected", async () =>
    assert.equal((await anon.get("/api/admin/players")).status(), 401),
  );
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
      await page
        .getByText(/You can explore the form; submission is available/)
        .waitFor({ timeout: 15000 });
      assert.match(
        await page.locator("body").innerText(),
        /24 November|24 Nov|not yet|opens/i,
      );
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
