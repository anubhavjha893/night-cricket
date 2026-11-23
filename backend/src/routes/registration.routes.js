import { issueUpload } from "../services/imagekit.service.js";
import { Router } from "express";
import { createRegistrationController } from "../controllers/registration.controller.js";
import { runWork } from "../middleware/work-limit.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import { createSubmissionLimiter } from "../middleware/rate-limit.middleware.js";
import {
  registrationAvailable,
  boundedUpload,
} from "../middleware/registration.middleware.js";

export function createRegistrationRouter(context) {
  const router = Router();
  router.post("/upload-ticket",createSubmissionLimiter(context.env),registrationAvailable(context.now),issueUpload);
  const controller = createRegistrationController(context);
  router.post(
    "/",
    createSubmissionLimiter(context.env),
    registrationAvailable(context.now),
    boundedUpload,
    context.workGate,
    upload.fields([
      { name: "playerPhoto", maxCount: 1 },
      { name: "paymentProof", maxCount: 1 },
    ]),
    runWork(controller.registerPlayer),
  );
  return router;
}
