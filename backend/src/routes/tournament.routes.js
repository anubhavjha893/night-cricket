import { Router } from "express";
import {
  createTournamentController,
  getHealth,
} from "../controllers/tournament.controller.js";
import { createQrLimiter } from "../middleware/rate-limit.middleware.js";

export function createTournamentRouter(context) {
  const router = Router();
  const controller = createTournamentController(context);
  router.get("/health", getHealth);
  router.get("/config", controller.getConfig);
  router.get(
    "/payment/qr",
    createQrLimiter(context.env),
    controller.getPaymentQr,
  );
  return router;
}
