import { Router } from "express";
import { getPrivateFile } from "../controllers/file.controller.js";
import { createFileLimiter } from "../middleware/rate-limit.middleware.js";

export function createFileRouter({ requireUser, env }) {
  const router = Router();
  router.get("/:id", requireUser, createFileLimiter(env), getPrivateFile);
  return router;
}
