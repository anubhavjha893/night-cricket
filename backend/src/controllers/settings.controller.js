import { paymentSettingsSchema } from "../validators/payment.schema.js";
import { Settings } from "../models/Settings.js";
import {
  checkImage,
  saveImage,
  deleteImage,
} from "../services/file.service.js";

export async function getSettings(req, res) {
  res.json(await Settings.findById("tournament").lean());
}

export async function updateSettings(req, res) {
  const result = paymentSettingsSchema.safeParse(req.body);
  if (!result.success)
    return res
      .status(400)
      .json({
        message: "Check your payment and registration settings.",
        errors: result.error.flatten().fieldErrors,
      });
  const old = await Settings.findById("tournament");
  let newFileId;
  try {
    if (req.file)
      newFileId = await saveImage(
        await checkImage(req.file, "Payment QR"),
        "payment-qr",
      );
    const update = {
      payeeName: result.data.payeeName,
      upiId: result.data.upiId,
      registrationMode: result.data.registrationMode,
    };
    if (newFileId) update.qrFileId = newFileId;
    const query = { $set: update };
    if (!newFileId && result.data.removeQr === "true")
      query.$unset = { qrFileId: 1 };
    const settings = await Settings.findByIdAndUpdate("tournament", query, {
      returnDocument: "after",
    });
    if ((newFileId || result.data.removeQr === "true") && old.qrFileId)
      await deleteImage(old.qrFileId);
    res.json({ message: "Settings saved.", settings });
  } catch (error) {
    await deleteImage(newFileId);
    throw error;
  }
}
