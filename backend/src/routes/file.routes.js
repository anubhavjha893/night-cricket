import { Router } from "express";
import { getPrivateFile } from "../controllers/file.controller.js";

export function createFileRouter({ requireUser }) {
  const router = Router();
  router.get("/:id", requireUser, getPrivateFile);
  return router;
}
