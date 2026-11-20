import { Router } from "express";
import { createAuthController } from "../controllers/auth.controller.js";
import {
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

export function createAdminRouter({ requireUser, session, loginLimiter }) {
  const router = Router();
  router.post("/login", loginLimiter, createAuthController(session).loginAdmin);
  router.use(requireUser, requireAdmin);
  router.get("/players", listPlayers);
  router.get("/players/:id", getPlayerDetails);
  router.patch("/players/:id/decision", reviewPlayer);
  router.get("/settings", getSettings);
  router.put("/settings", upload.single("paymentQr"), updateSettings);
  return router;
}
