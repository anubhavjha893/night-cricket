import cors from "cors";
import helmet from "helmet";
import { createApiLimiter } from "./rate-limit.middleware.js";
import { SESSION_COOKIE } from "../config/auth.js";

export function configureSecurity(app, env) {
  const origins = (
    env.APP_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((v) => v.trim());
  const production = env.NODE_ENV === "production";
  if (
    env.TRUSTED_PROXY_CIDRS?.split(",").some((value) =>
      ["0.0.0.0/0", "::/0", "*", "true"].includes(value.trim()),
    )
  )
    throw new Error(
      "Trust only the exact proxy IPs/CIDRs, never all addresses.",
    );
  app.disable("x-powered-by");
  if (env.TRUST_PROXY && env.TRUST_PROXY !== "0")
    throw new Error(
      "Use TRUSTED_PROXY_CIDRS with exact proxy addresses; numeric hop counts are not accepted.",
    );
  app.set(
    "trust proxy",
    env.TRUSTED_PROXY_CIDRS
      ? env.TRUSTED_PROXY_CIDRS.split(",").map((v) => v.trim())
      : false,
  );
  if (
    production &&
    (!env.APP_ORIGIN ||
      origins.some((origin) => !origin.startsWith("https://")))
  )
    throw new Error("Production APP_ORIGIN must list exact HTTPS origins.");
  if (
    env.COOKIE_SAME_SITE &&
    !["lax", "strict", "none"].includes(env.COOKIE_SAME_SITE)
  )
    throw new Error("Invalid COOKIE_SAME_SITE.");
  if (!production && env.COOKIE_SAME_SITE === "none")
    throw new Error("Cross-site cookies require production HTTPS.");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
    }),
  );
  app.use(
    cors({
      origin(origin, cb) {
        cb(null, !origin || origins.includes(origin));
      },
      credentials: true,
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      !origins.includes(req.headers.origin)
    )
      return res.status(403).json({ message: "This origin is not allowed." });
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      ((req.headers["sec-fetch-site"] === "cross-site" &&
        !origins.includes(req.headers.origin)) ||
        (req.headers.cookie?.includes(`${SESSION_COOKIE}=`) &&
          !req.headers.origin))
    )
      return res.status(403).json({
        message: "A trusted Origin header is required for signed-in changes.",
      });
    next();
  });
  app.use("/api", createApiLimiter(env));
}
