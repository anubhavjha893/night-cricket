import { Player } from "../models/index.js";
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
