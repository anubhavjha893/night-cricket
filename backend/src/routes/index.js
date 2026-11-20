import { Router } from "express";
import { createSessionService } from "../services/session.service.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { createLoginLimiter } from "../middleware/rate-limit.middleware.js";
import { createTournamentRouter } from "./tournament.routes.js";
import { createAuthRouter } from "./auth.routes.js";
import { createRegistrationRouter } from "./registration.routes.js";
import { createPlayerRouter } from "./player.routes.js";
import { createFileRouter } from "./file.routes.js";
import { createAdminRouter } from "./admin.routes.js";

export function createApiRouter({ env, now }) {
  const router = Router();
  const context = {
    env,
    now,
    session: createSessionService(env),
    requireUser: createAuthMiddleware(env),
    loginLimiter: createLoginLimiter(),
  };
  router.use(createTournamentRouter(context));
  router.use("/auth", createAuthRouter(context));
  router.use("/registrations", createRegistrationRouter(context));
  router.use("/player", createPlayerRouter(context));
  router.use("/files", createFileRouter(context));
  router.use("/admin", createAdminRouter(context));
  router.use((req, res) =>
    res.status(404).json({ message: "API endpoint not found." }),
  );
  return router;
}
