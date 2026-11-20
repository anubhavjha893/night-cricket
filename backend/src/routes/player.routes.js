import { Router } from "express";
import {
  getPlayerProfile,
  markNotificationsRead,
} from "../controllers/player.controller.js";

export function createPlayerRouter({ requireUser }) {
  const router = Router();
  router.use(requireUser);
  router.get("/me", getPlayerProfile);
  router.post("/notifications/read", markNotificationsRead);
  return router;
}
