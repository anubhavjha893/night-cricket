import { z } from "zod";
import { Player } from "../models/index.js";
import { registrationSchema } from "../validators/registration.schema.js";
import { phoneSchema } from "../validators/common.schema.js";
import {
  checkImage,
  saveImage,
  deleteImage,
} from "../services/file.service.js";
import { fail } from "../utils/http-error.js";

const schema = registrationSchema
  .omit({ password: true, transactionReference: true })
  .extend({
    submissionRevision: z.coerce
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER - 1),
  });
const keyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function received(player, res) {
  return res.json({
    registrationId: player.registrationId,
    status: player.status,
    message: "Your corrections have been received. Verification is pending.",
  });
}

export async function allowResubmission(req, res, next) {
  if (req.role !== "player")
    throw fail(403, "Only a player can correct their own registration.");
  const key = req.get("Idempotency-Key");
  if (!keyPattern.test(key || ""))
    throw fail(400, "Reopen the correction form and try again.");
  const player = await Player.findById(req.user._id).select(
    "+lastResubmissionKey",
  );
  if (!player)
    throw fail(401, "Your session is no longer valid. Please sign in.");
  if (player.status === "pending" && player.lastResubmissionKey === key)
    return received(player, res);
  if (player.status !== "rejected")
    throw fail(
      409,
      "Only rejected registrations can be corrected. Check your current status.",
    );
  if (player.lastResubmissionKey === key)
    throw fail(
      409,
      "This correction was already processed. Reopen the form for the latest review.",
    );
  req.resubmission = { player, key };
  next();
}

export async function resubmitPlayer(req, res) {
  const { player, key } = req.resubmission;
  let roles;
  try {
    roles = JSON.parse(req.body.roles || "[]");
  } catch {
    throw fail(400, "Select your player role.");
  }
  const result = schema.safeParse({ ...req.body, roles });
  if (!result.success)
    return res
      .status(400)
      .json({
        message: "Please check your corrected details.",
        errors: result.error.flatten().fieldErrors,
      });
  const { phone, declaration, submissionRevision, ...details } = result.data;
  const savedPhone = phoneSchema.safeParse(player.phone);
  if (!savedPhone.success || savedPhone.data !== phone)
    throw fail(
      400,
      "Your sign-in mobile number cannot be changed here. Contact the organiser for help.",
    );
  const photo = req.files?.playerPhoto?.[0]
    ? await checkImage(req.files.playerPhoto[0], "Player photograph")
    : null;
  const proof = req.files?.paymentProof?.[0]
    ? await checkImage(req.files.paymentProof[0], "Payment screenshot")
    : null;
  if (!photo && !player.playerPhotoId)
    throw fail(400, "Player photograph is required.");
  if (!proof && !player.paymentProofId)
    throw fail(400, "Payment screenshot is required.");
  const saved = [];
  let committed = false;
  try {
    if (photo) {
      details.playerPhotoId = await saveImage(photo, "player-photo");
      saved.push(details.playerPhotoId);
    }
    if (proof) {
      details.paymentProofId = await saveImage(proof, "payment-proof");
      saved.push(details.paymentProofId);
    }
    const revisions = [{ submissionRevision }];
    if (submissionRevision === 0)
      revisions.push({ submissionRevision: { $exists: false } });
    const updated = await Player.findOneAndUpdate(
      { _id: player._id, status: "rejected", $or: revisions },
      {
        $set: {
          ...details,
          status: "pending",
          rejectionReason: "",
          lastResubmissionKey: key,
        },
        $unset: { reviewedAt: 1, reviewedBy: 1 },
        $inc: { submissionRevision: 1 },
        $push: {
          notifications: {
            kind: "submitted",
            message:
              "Your corrected registration has been resubmitted and is pending verification. Your registration ID remains the same.",
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated) {
      const current = await Player.findById(player._id).select(
        "+lastResubmissionKey",
      );
      if (
        current?.status === "pending" &&
        current.lastResubmissionKey === key
      ) {
        await Promise.all(saved.map((id) => deleteImage(id).catch(() => {})));
        return received(current, res);
      }
      throw fail(
        409,
        "This registration changed during editing. Reopen the correction form for the latest details.",
      );
    }
    committed = true;
    const replaced = [
      photo && player.playerPhotoId,
      proof && player.paymentProofId,
    ].filter(Boolean);
    await Promise.all(replaced.map((id) => deleteImage(id).catch(() => {})));
    return received(updated, res);
  } catch (error) {
    if (!committed)
      await Promise.all(saved.map((id) => deleteImage(id).catch(() => {})));
    throw error;
  }
}
