import QRCode from "qrcode";

// Keep only the current QR; share its in-flight generation across requests.
let cachedKey, cachedPromise;
export function paymentQr(params) {
  const key = `upi://pay?${params}`;
  if (key !== cachedKey) {
    cachedKey = key;
    cachedPromise = QRCode.toBuffer(key, {
      width: 400,
      margin: 3,
      errorCorrectionLevel: "M",
    }).catch((error) => {
      if (cachedKey === key) {
        cachedKey = undefined;
        cachedPromise = undefined;
      }
      throw error;
    });
  }
  return cachedPromise;
}
