import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import { configureSecurity } from "./middleware/security.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { createApiRouter } from "./routes/index.js";

export function createApp({ env = process.env, now = () => new Date() } = {}) {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32)
    throw new Error(
      "Set JWT_SECRET to a random secret of at least 32 characters.",
    );
  const app = express();
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
