import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

export function configureSecurity(app, env) {
  const origins = (
    env.APP_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((v) => v.trim());
  const production = env.NODE_ENV === "production";
  app.disable("x-powered-by");
  app.set("trust proxy", Number(env.TRUST_PROXY || 0));
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
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 200,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { message: "Too many requests. Please try again in a minute." },
    }),
  );
}
