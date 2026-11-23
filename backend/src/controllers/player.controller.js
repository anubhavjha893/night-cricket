import { acceptUpload } from "../services/imagekit.service.js";
import { Player } from "../models/index.js";
import {
  checkImage,
  saveImage,
  deleteImage,
} from "../services/file.service.js";
import { fail } from "../utils/http-error.js";

export async function getPlayerProfile(req, res) {
  if (req.role !== "player")
    throw fail(403, "Sign in as a player to view your registration.");
  const player = req.user.toObject();
  delete player.reviewedBy;
  res.json(player);
}

export async function markNotificationsRead(req, res) {
  if (req.role !== "player") throw fail(403, "Player access required.");
  await Player.updateOne(
    { _id: req.user._id },
    { $set: { "notifications.$[unread].readAt": new Date() } },
    { arrayFilters: [{ "unread.readAt": { $exists: false } }] },
  );
  res.json({ ok: true });
}

export async function replacePlayerPhoto(req, res) {
  if (Object.keys(req.body || {}).some(key=>key!=="playerPhotoRef"))
    throw fail(400, "Only the player photograph can be changed here.");
  const photo = await checkImage((await acceptUpload(req,"playerPhoto")) || req.file, "Player photograph");
  const playerPhotoId = await saveImage(photo, "player-photo");
  let previous;
  try {
    previous = await Player.findOneAndUpdate(
      { _id: req.user._id, playerPhotoId: req.user.playerPhotoId },
      { $set: { playerPhotoId } },
      { returnDocument: "before", projection: { playerPhotoId: 1 } },
    );
    if (!previous)
      throw fail(409, "Your photograph changed. Refresh and try again.");
  } catch (error) {
    await deleteImage(playerPhotoId,req.app.locals.mediaEnv);
    throw error;
  }
  await deleteImage(previous.playerPhotoId,req.app.locals.mediaEnv);
  res.json({ playerPhotoId });
}
