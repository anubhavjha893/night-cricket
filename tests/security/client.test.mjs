import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("API requests have a finite deadline and preserve caller cancellation", async () => {
  const text = (
    await readFile(
      new URL("../../frontend/src/services/api.js", import.meta.url),
      "utf8",
    )
  ).replaceAll("import.meta.env.VITE_API_URL", '""');
  const { api } = await import(
    `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`
  );
  const originalFetch = globalThis.fetch,
    originalTimeout = AbortSignal.timeout;
  const timers = [];
  let duration;
  AbortSignal.timeout = (ms) => {
    duration = ms;
    const controller = new AbortController();
    timers.push(
      setTimeout(
        () => controller.abort(new DOMException("Timeout", "TimeoutError")),
        10,
      ),
    );
    return controller.signal;
  };
  globalThis.fetch = (_, options) =>
    new Promise((_, reject) => {
      if (options.signal.aborted) reject(options.signal.reason);
      else
        options.signal.addEventListener(
          "abort",
          () => reject(options.signal.reason),
          { once: true },
        );
    });
  try {
    await assert.rejects(api("/config"), (error) => error.status === 504);
    assert.equal(duration, 15000);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      api("/config", { signal: controller.signal }),
      (error) => error.name === "AbortError",
    );
    await assert.rejects(
      api("/registrations", { method: "POST", body: new FormData() }),
      (error) => error.status === 504,
    );
    assert.equal(duration, 35000);
  } finally {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
    timers.forEach(clearTimeout);
  }
});
