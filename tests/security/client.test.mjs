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
    assert.equal(duration, 60000);
    await assert.rejects(
      api("/admin/settings"),
      (error) => error.status === 504,
    );
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

test("startup reads retry temporary gateway HTML but writes are never replayed", async () => {
  const source = (
    await readFile(
      new URL("../../frontend/src/services/api.js", import.meta.url),
      "utf8",
    )
  ).replaceAll("import.meta.env.VITE_API_URL", '""');
  const { api } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
  const originalFetch = globalThis.fetch,
    originalSetTimeout = globalThis.setTimeout;
  const delays = [];
  let calls = 0;
  globalThis.setTimeout = (fn, ms, ...args) => {
    delays.push(ms);
    return originalSetTimeout(fn, 0, ...args);
  };
  try {
    globalThis.fetch = async () => {
      calls++;
      return calls === 1
        ? new Response("<html>Gateway warming up</html>", {
            status: 502,
            headers: { "Content-Type": "text/html" },
          })
        : new Response('{"ok":true}', {
            headers: { "Content-Type": "application/json" },
          });
    };
    assert.deepEqual(await api("/config"), { ok: true });
    assert.equal(calls, 2);
    assert.deepEqual(delays, [1000]);
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response("Gateway error", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      });
    };
    await assert.rejects(
      api("/registrations", { method: "POST", body: new FormData() }),
      (error) => error.status === 503 && /waking up/.test(error.message),
    );
    assert.equal(calls, 1);
    calls = 0;
    await assert.rejects(api("/config"), (error) => error.status === 503);
    assert.equal(calls, 9);
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response('{"message":"Sign in"}', {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    };
    await assert.rejects(api("/auth/me"), (error) => error.status === 401);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});
