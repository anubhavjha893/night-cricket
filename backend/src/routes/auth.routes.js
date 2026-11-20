import { Router } from "express";
import { createAuthController } from "../controllers/auth.controller.js";
import { runWork } from "../middleware/work-limit.middleware.js";

export function createAuthRouter({
  session,
  requireUser,
  loginLimiter,
  workGate,
  env,
}) {
  const router = Router();
  const controller = createAuthController(session, env);
  router.post(
    "/login",
    loginLimiter,
    workGate,
    runWork(controller.loginPlayer),
  );
  router.post("/logout", controller.logout);
  router.get("/me", requireUser, controller.getSession);
  return router;
}
