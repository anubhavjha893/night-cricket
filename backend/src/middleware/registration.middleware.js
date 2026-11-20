import { Settings } from "../models/Settings.js";
import { registrationWindow } from "../services/registration-window.service.js";
import { fail } from "../utils/http-error.js";

export const registrationAvailable = (now) => async (req, res, next) => {
  const settings = await Settings.findById("tournament").maxTimeMS(2000);
  if (!settings) throw fail(503, "Tournament configuration is unavailable.");
  const window = registrationWindow(settings, now());
  if (!window.isOpen) throw fail(409, window.message);
  if (!settings.qrFileId && !settings.upiId)
    throw fail(
      503,
      "Payment is not configured yet. Please contact the organiser.",
    );
  next();
};
export function boundedUpload(req, res, next) {
  if (Number(req.headers["content-length"] || 0) > 11 * 1024 * 1024)
    return res.status(413).json({
      message:
        "The upload request is too large. Each image must be 5 MB or smaller.",
    });
  next();
}
