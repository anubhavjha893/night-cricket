import { Router } from "express";
import {
  allowResubmission,
  resubmitPlayer,
} from "../controllers/resubmission.controller.js";
import { createSubmissionLimiter } from "../middleware/rate-limit.middleware.js";
import { boundedUpload } from "../middleware/registration.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import { runWork } from "../middleware/work-limit.middleware.js";
import {
  getPlayerProfile,
  markNotificationsRead,
} from "../controllers/player.controller.js";

export function createPlayerRouter({ requireUser, env, workGate }) {
  const router = Router();
  router.use(requireUser);
  router.get("/me", getPlayerProfile);
  router.post("/notifications/read", markNotificationsRead);
  router.post(
    "/resubmit",
    createSubmissionLimiter(env),
    allowResubmission,
    boundedUpload,
    workGate,
    upload.fields([
      { name: "playerPhoto", maxCount: 1 },
      { name: "paymentProof", maxCount: 1 },
    ]),
    runWork(resubmitPlayer),
  );
  return router;
}
