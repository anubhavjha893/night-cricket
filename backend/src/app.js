import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import { configureSecurity } from "./middleware/security.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { createApiRouter } from "./routes/index.js";
import mongoose from "mongoose";
import { createObservability } from "./middleware/observability.middleware.js";

export function createApp({ env = process.env, now = () => new Date() } = {}) {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32)
    throw new Error(
      "Set JWT_SECRET to a random secret of at least 32 characters.",
    );
  const app = express();
  const observation = createObservability(env);
  app.locals.observation = observation;
  app.use(observation.middleware);
  app.use(["/api/live", "/api/ready"], (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/live", (req, res) => res.json({ ok: true }));
  let readinessPromise,
    readinessAt = 0;
  app.get("/api/ready", async (req, res) => {
    if (app.locals.draining || mongoose.connection.readyState !== 1)
      return res.status(503).json({ ok: false });
    if (!readinessPromise || Date.now() - readinessAt >= 1000) {
      readinessAt = Date.now();
      readinessPromise = mongoose.connection.db
        .command({ ping: 1 }, { timeoutMS: 1000 })
        .then(
          () => true,
          () => false,
        );
    }
    const ready = await readinessPromise;
    res.status(ready ? 200 : 503).json({ ok: ready });
  });
  app.use("/api", (req, res, next) => {
    if (app.locals.draining || mongoose.connection.readyState !== 1)
      return res.set("Retry-After", "2").status(503).json({
        message: "The service is temporarily unavailable. Please retry.",
        retryAfterSeconds: 2,
      });
    next();
  });
  configureSecurity(app, env);
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use("/api", createApiRouter({ env, now }));

  const dist = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
  if (existsSync(path.join(dist, "index.html"))) {
    app.use(express.static(dist, { index: false }));
    app.get("/{*path}", (req, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
  }
  app.use(errorHandler);
  return app;
}
