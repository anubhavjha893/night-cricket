import { Player, Settings } from "../models/index.js";
import { fail } from "../utils/http-error.js";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { tournament } from "../config/tournament.js";
import { registrationSchema } from "../validators/registration.schema.js";
import { registrationWindow } from "../services/registration-window.service.js";
import {
  checkImage,
  saveImage,
  deleteImage,
} from "../services/file.service.js";

export function createRegistrationController({ session, now }) {
  async function registerPlayer(req, res) {
    const settings = await Settings.findById("tournament");
    const window = registrationWindow(settings, now());
    if (!window.isOpen) throw fail(409, window.message);
    if (!settings.qrFileId && !settings.upiId)
      throw fail(
        503,
        "Payment is not configured yet. Please contact the organiser.",
      );
    let roles;
    try {
      roles = JSON.parse(req.body.roles || "[]");
    } catch {
      throw fail(400, "Select your player role.");
    }
    const result = registrationSchema.safeParse({ ...req.body, roles });
    if (!result.success)
      return res
        .status(400)
        .json({
          message: "Please check your registration details.",
          errors: result.error.flatten().fieldErrors,
        });
    const { password, declaration, ...data } = result.data;
    if (await Player.exists({ phone: data.phone }))
      throw fail(
        409,
        "This mobile number is already registered. Sign in to track your application.",
      );
    if (
      await Player.exists({ transactionReference: data.transactionReference })
    )
      throw fail(
        409,
        "This payment reference has already been submitted. Contact the organiser.",
      );
    const photo = await checkImage(
      req.files?.playerPhoto?.[0],
      "Player photograph",
    );
    const proof = await checkImage(
      req.files?.paymentProof?.[0],
      "Payment screenshot",
    );
    const saved = [];
    try {
      const playerPhotoId = await saveImage(photo, "player-photo");
      saved.push(playerPhotoId);
      const paymentProofId = await saveImage(proof, "payment-proof");
      saved.push(paymentProofId);
      const player = await Player.create({
        ...data,
        playerPhotoId,
        paymentProofId,
        passwordHash: await bcrypt.hash(password, 12),
        registrationId: `UGM2-${randomBytes(6).toString("hex").toUpperCase()}`,
        paymentAmount: tournament.fee,
        notifications: [
          {
            kind: "submitted",
            message:
              "Your registration has been received and is pending payment and player-detail verification.",
          },
        ],
      });
      session.setSession(res, player, "player");
      res
        .status(201)
        .json({
          registrationId: player.registrationId,
          status: player.status,
          message: "Registration received. Verification is pending.",
        });
    } catch (error) {
      await Promise.all(saved.map(deleteImage));
      throw error;
    }
  }

  return { registerPlayer };
}
