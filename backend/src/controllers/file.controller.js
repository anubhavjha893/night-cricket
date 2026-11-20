import { sendImage } from "../services/file.service.js";
import { fail } from "../utils/http-error.js";
import { idIsValid } from "../utils/object-id.js";

export async function getPrivateFile(req, res) {
  if (!idIsValid(req.params.id)) throw fail(404, "Image not found.");
  if (
    req.role !== "admin" &&
    ![req.user.playerPhotoId, req.user.paymentProofId].some(
      (id) => String(id) === req.params.id,
    )
  )
    throw fail(403, "You cannot view this image.");
  return sendImage(req.params.id, res);
}
