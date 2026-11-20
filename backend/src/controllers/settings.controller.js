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
    return res.status(400).json({
      message: "Check your payment, registration and auction settings.",
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
    // Older clients omit this field; keep the saved auction date in that case.
    if (result.data.auctionDate !== undefined)
      update.auctionDate = result.data.auctionDate;
    if (newFileId) update.qrFileId = newFileId;
    const query = { $set: update };
    if (!newFileId && result.data.removeQr === "true")
      query.$unset = { qrFileId: 1 };
    const settings = await Settings.findOneAndUpdate(
      { _id: "tournament", updatedAt: old.updatedAt },
      query,
      {
        returnDocument: "after",
      },
    );
    if (!settings)
      throw Object.assign(
        new Error(
          "Settings changed during this update. Refresh and try again.",
        ),
        { status: 409 },
      );
    if ((newFileId || result.data.removeQr === "true") && old.qrFileId)
      await deleteImage(old.qrFileId);
    res.json({ message: "Settings saved.", settings });
  } catch (error) {
    await deleteImage(newFileId);
    throw error;
  }
}
