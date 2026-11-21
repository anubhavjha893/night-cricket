import { paymentQr } from "../services/qr.service.js";
import { Settings } from "../models/Settings.js";
import { tournament } from "../config/tournament.js";
import { registrationWindow } from "../services/registration-window.service.js";
import { sendImage } from "../services/file.service.js";
import { fail } from "../utils/http-error.js";

export async function getHealth(req, res) {
  const ready = await req.app.locals.checkReadiness();
  if (!ready) res.set("Retry-After", "10");
  res
    .status(ready ? 200 : 503)
    .type("text/plain")
    .send(ready ? "health is good" : "service temporarily unavailable");
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
    const png = await paymentQr(params);
    res.type("png").send(png);
  }

  return { getConfig, getPaymentQr };
}
