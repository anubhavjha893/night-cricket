import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

const routeLabel = (path) => {
  const normalized = path
    .split("?")[0]
    .replace(/\/[a-f0-9]{24}(?=\/|$)/gi, "/:id");
  return /^\/api\/(auth\/(login|logout|me)|admin\/(login|players|players\/:id|players\/:id\/decision|settings|metrics)|player\/(me|notifications\/read|resubmit)|files\/:id|registrations|payment\/qr|config|health|ready|live)$/.test(
    normalized,
  )
    ? normalized
    : "other";
};
export function createObservability(env) {
  const routes = new Map();
  const startedAt = new Date().toISOString();
  function middleware(req, res, next) {
    const id = randomUUID(),
      start = performance.now();
    req.requestId = id;
    res.set("X-Request-Id", id);
    res.once("finish", () => {
      const route = routeLabel(req.originalUrl),
        durationMs = performance.now() - start;
      const metric = routes.get(route) || {
        requests: 0,
        serverErrors: 0,
        rateLimited: 0,
        samples: [],
      };
      metric.requests++;
      if (res.statusCode >= 500) metric.serverErrors++;
      if (res.statusCode === 429) metric.rateLimited++;
      if (metric.samples.length >= 2048) metric.samples.shift();
      metric.samples.push(durationMs);
      routes.set(route, metric);
      if (env.REQUEST_LOGS === "true")
        console.info(
          JSON.stringify({
            requestId: id,
            route,
            method: req.method,
            status: res.statusCode,
            durationMs: +durationMs.toFixed(2),
          }),
        );
    });
    next();
  }
  function snapshot() {
    return {
      startedAt,
      window: "p95 of last 2048 requests per route; totals since process start",
      rssBytes: process.memoryUsage().rss,
      routes: Object.fromEntries(
        [...routes].map(([route, value]) => {
          const sorted = [...value.samples].sort((a, b) => a - b);
          return [
            route,
            {
              requests: value.requests,
              serverErrors: value.serverErrors,
              rateLimited: value.rateLimited,
              p95Ms: +(
                sorted[Math.ceil(sorted.length * 0.95) - 1] || 0
              ).toFixed(2),
            },
          ];
        }),
      ),
    };
  }
  return { middleware, snapshot };
}
