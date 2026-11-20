import { Router } from "express";
import { createAuthController } from "../controllers/auth.controller.js";

export function createAuthRouter({ session, requireUser, loginLimiter }) {
  const router = Router();
  const controller = createAuthController(session);
  router.post("/login", loginLimiter, controller.loginPlayer);
  router.post("/logout", controller.logout);
  router.get("/me", requireUser, controller.getSession);
  return router;
}
