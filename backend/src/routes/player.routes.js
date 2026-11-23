import { issueUpload } from "../services/imagekit.service.js";
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
  replacePlayerPhoto,
} from "../controllers/player.controller.js";

export function createPlayerRouter({ requireUser, env, workGate }) {
  const router = Router();
  router.use(requireUser);
  router.post("/upload-ticket",createSubmissionLimiter(env),(req,res,next)=>req.role==="player"?next():res.sendStatus(403),issueUpload);
  router.get("/me", getPlayerProfile);
  router.put(
    "/photo",
    (req, res, next) =>
      req.role === "player"
        ? next()
        : res.status(403).json({ message: "Player access required." }),
    createSubmissionLimiter(env),
    boundedUpload,
    workGate,
    upload.single("playerPhoto"),
    runWork(replacePlayerPhoto),
  );
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
