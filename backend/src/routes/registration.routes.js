import { Router } from "express";
import { createRegistrationController } from "../controllers/registration.controller.js";
import { upload } from "../middleware/upload.middleware.js";
import { createSubmissionLimiter } from "../middleware/rate-limit.middleware.js";

export function createRegistrationRouter(context) {
  const router = Router();
  const controller = createRegistrationController(context);
  router.post(
    "/",
    createSubmissionLimiter(),
    upload.fields([
      { name: "playerPhoto", maxCount: 1 },
      { name: "paymentProof", maxCount: 1 },
    ]),
    controller.registerPlayer,
  );
  return router;
}
