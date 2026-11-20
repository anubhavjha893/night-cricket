import { Player, Settings } from "../models/index.js";
import { fail } from "../utils/http-error.js";

import {
  hashPassword,
  verifyPassword,
  writePasswordScheme,
} from "../services/password.service.js";
import { randomBytes } from "node:crypto";
import { tournament } from "../config/tournament.js";
import { registrationSchema } from "../validators/registration.schema.js";
import { registrationWindow } from "../services/registration-window.service.js";
import {
  checkImage,
  saveImage,
  deleteImage,
} from "../services/file.service.js";

export function createRegistrationController({ session, now, env }) {
  async function replayRegistration(data, password, res) {
    const existing = await Player.findOne({
      phone: data.phone,
      ...(data.transactionReference
        ? { transactionReference: data.transactionReference }
        : {}),
    }).select("+passwordHash +passwordScheme");
    if (!existing || !(await verifyPassword(password, existing, env)))
      return false;
    session.setSession(res, existing, "player");
    res.status(200).json({
      registrationId: existing.registrationId,
      status: existing.status,
      message:
        "Your existing registration was recovered. No duplicate was created.",
    });
    return true;
  }
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
      return res.status(400).json({
        message: "Please check your registration details.",
        errors: result.error.flatten().fieldErrors,
      });
    const { password: legacyPassword, declaration, ...data } = result.data;
    // New forms omit the password. Keep older, already-open clients compatible.
    const password = legacyPassword ?? data.phone;
    if (await replayRegistration(data, password, res)) return;
    if (!writePasswordScheme(env) && Buffer.byteLength(password, "utf8") > 72)
      return res.status(400).json({
        message: "Please check your password.",
        errors: { password: ["Use a password of at most 72 UTF-8 bytes."] },
      });
    if (await Player.exists({ phone: data.phone }))
      throw fail(
        409,
        "This mobile number is already registered. Sign in to track your application.",
      );
    if (
      data.transactionReference &&
      (await Player.exists({ transactionReference: data.transactionReference }))
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
        passwordHash: await hashPassword(password, env),
        passwordScheme: writePasswordScheme(env),
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
      res.status(201).json({
        registrationId: player.registrationId,
        status: player.status,
        message: "Registration received. Verification is pending.",
      });
    } catch (error) {
      await Promise.all(saved.map(deleteImage));
      if (
        error.code === 11000 &&
        (await replayRegistration(data, password, res))
      )
        return;
      throw error;
    }
  }

  return { registerPlayer };
}
