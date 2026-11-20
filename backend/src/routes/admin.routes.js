import { Router } from "express";
import { createAuthController } from "../controllers/auth.controller.js";
import { runWork } from "../middleware/work-limit.middleware.js";
import {
  getAdminSummary,
  listPlayers,
  getPlayerDetails,
  reviewPlayer,
} from "../controllers/admin.controller.js";
import {
  getSettings,
  updateSettings,
} from "../controllers/settings.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import { boundedUpload } from "../middleware/registration.middleware.js";
import {
  createSearchLimiter,
  createFileLimiter,
} from "../middleware/rate-limit.middleware.js";

export function createAdminRouter({
  requireUser,
  session,
  loginLimiter,
  workGate,
  env,
}) {
  const router = Router();
  router.post(
    "/login",
    loginLimiter,
    workGate,
    runWork(createAuthController(session, env).loginAdmin),
  );
  router.use(requireUser, requireAdmin);
  router.get("/summary", getAdminSummary);
  router.get("/metrics", (req, res) =>
    res.json(req.app.locals.observation.snapshot()),
  );
  router.get("/players", createSearchLimiter(env), listPlayers);
  router.get("/players/:id", getPlayerDetails);
  router.patch("/players/:id/decision", reviewPlayer);
  router.get("/settings", getSettings);
  router.put(
    "/settings",
    createFileLimiter(env),
    boundedUpload,
    workGate,
    upload.single("paymentQr"),
    runWork(updateSettings),
  );
  return router;
}
