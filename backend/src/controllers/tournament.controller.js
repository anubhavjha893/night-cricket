import mongoose from "mongoose";
import QRCode from "qrcode";
import { Settings } from "../models/Settings.js";
import { tournament } from "../config/tournament.js";
import { registrationWindow } from "../services/registration-window.service.js";
import { sendImage } from "../services/file.service.js";
import { fail } from "../utils/http-error.js";

export function getHealth(req, res) {
  res.json({ ok: mongoose.connection.readyState === 1 });
}

export function createTournamentController({ now }) {
  async function getConfig(req, res) {
    const settings = await Settings.findById("tournament");
    res.json({
      ...tournament,
      registration: registrationWindow(settings, now()),
      payment: {
        configured: Boolean(settings.qrFileId || settings.upiId),
        uploadedQr: Boolean(settings.qrFileId),
        payeeName: settings.payeeName,
        upiId: settings.upiId,
        qrUrl: settings.qrFileId || settings.upiId ? "/api/payment/qr" : null,
        amount: tournament.fee,
      },
    });
  }

  async function getPaymentQr(req, res) {
    const settings = await Settings.findById("tournament");
    if (settings.qrFileId) return sendImage(settings.qrFileId, res);
    if (!settings.upiId)
      throw fail(503, "The organiser has not configured the payment QR yet.");
    const params = new URLSearchParams({
      pa: settings.upiId,
      pn: settings.payeeName,
      am: String(tournament.fee),
      cu: "INR",
      tn: "UGM Season 2 registration",
    });
    const png = await QRCode.toBuffer(`upi://pay?${params}`, {
      width: 400,
      margin: 3,
      errorCorrectionLevel: "M",
    });
    res.type("png").send(png);
  }

  return { getConfig, getPaymentQr };
}
