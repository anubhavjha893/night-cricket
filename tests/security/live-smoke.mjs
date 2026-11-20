import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

// Token is supplied once through stdin, never arguments, files, URLs or output.
const line = await new Promise((resolve, reject) => {
  let input = "";
  const terminal = process.stdin.isTTY;
  const receive = (chunk) => {
    input += chunk;
    if (input.length > 65536) {
      finish();
      reject(new Error("Input too large."));
    } else if (/[\r\n]/.test(input)) {
      finish();
      resolve(input);
    }
  };
  function finish() {
    process.stdin.removeListener("data", receive);
    if (terminal) process.stdin.setRawMode(false);
    process.stdin.pause();
  }
  if (terminal) process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", receive);
  process.stdin.resume();
  console.log(
    "Ready for private smoke-check configuration on stdin (input is hidden).",
  );
});
const { url, token, label, version, commit } = JSON.parse(line);
if (
  !["before", "after"].includes(label) ||
  new URL(url).origin !==
    "https://night-cricket-player-registration.bladedcod1.chatgpt.site"
)
  throw new Error("Unexpected smoke-check target.");
const result = {
  label,
  url,
  version,
  commit,
  scope:
    "low-volume, read-only private static preview; no registration or payment submitted",
  checks: {},
};
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "msedge" : "chromium",
  headless: true,
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.route("**/*", (route) => {
    const request = route.request();
    return route.continue({
      headers: {
        ...request.headers(),
        ...(new URL(request.url()).origin === new URL(url).origin && token
          ? { "OAI-Sites-Authorization": `Bearer ${token}` }
          : {}),
      },
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.name));
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  result.checks.homeHttpStatus = response.status();
  await page
    .getByRole("heading", { name: /FOR THE LOVE/ })
    .waitFor({ timeout: 15000 });
  result.checks.homeContent = true;
  const gallery = page.locator(".season-highlights");
  await gallery.scrollIntoViewIfNeeded();
  for (const image of await gallery.locator("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((el) => el.decode());
  }
  result.checks.seasonOnePhotos = await gallery
    .locator("img")
    .evaluateAll(
      (images) =>
        images.length === 2 &&
        images.every((image) => image.naturalWidth === 1536),
    );
  await page.goto(`${url}/#/login`);
  await page.getByLabel(/^Mobile number/).waitFor();
  await page
    .getByRole("navigation", { name: "Sign-in type" })
    .getByRole("link", { name: "Admin", exact: true })
    .click();
  await page.getByLabel(/^Email address/).waitFor();
  result.checks.adminEmailMode = true;
  await page.goto(`${url}/#/register`);
  await page
    .getByRole("heading", { name: "Personal details", exact: true })
    .waitFor();
  await page
    .getByRole("alert")
    .filter({ hasText: /registration service/ })
    .waitFor({ timeout: 20000 });
  result.checks.registrationServiceUnavailable = true;
  result.criticalRegistrationFlow =
    "UNVERIFIED LIVE / unavailable: this host deploys static assets only; no Express/MongoDB API is configured";
  result.checks.javascriptErrors = errors.length;
  if (errors.length || !result.checks.seasonOnePhotos)
    throw new Error("Visible-content smoke check failed.");
  result.result =
    "static preview smoke passed; registration backend is a production blocker";
} catch (error) {
  result.result = "failed";
  result.failureType = error.name;
  process.exitCode = 1;
} finally {
  await browser.close();
  await mkdir("test-results/security", { recursive: true });
  await writeFile(
    `test-results/security/live-${label}.json`,
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
}
