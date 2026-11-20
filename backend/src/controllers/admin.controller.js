import { Player } from "../models/index.js";
import { fail } from "../utils/http-error.js";
import { idIsValid } from "../utils/object-id.js";
import { decisionSchema } from "../validators/admin.schema.js";

export async function listPlayers(req, res) {
  const status = ["pending", "approved", "rejected"].includes(req.query.status)
    ? req.query.status
    : null;
  const search = String(req.query.search || "")
    .trim()
    .slice(0, 100);
  const filter = status ? { status } : {};
  if (search)
    filter.$or = ["name", "phone", "registrationId"].map((key) => ({
      [key]: {
        $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      },
    }));
  const page = Math.max(
    1,
    Math.min(Number.parseInt(req.query.page, 10) || 1, 100000),
  );
  const [players, total, groups] = await Promise.all([
    Player.find(filter)
      .select("name phone registrationId roles status createdAt")
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * 20)
      .limit(20)
      .lean(),
    Player.countDocuments(filter),
    Player.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  res.json({
    players,
    total,
    page,
    pages: Math.ceil(total / 20),
    counts: Object.fromEntries(groups.map((group) => [group._id, group.count])),
  });
}

export async function getPlayerDetails(req, res) {
  if (!idIsValid(req.params.id)) throw fail(404, "Player not found.");
  const player = await Player.findById(req.params.id).lean();
  if (!player) throw fail(404, "Player not found.");
  res.json(player);
}

export async function reviewPlayer(req, res) {
  if (!idIsValid(req.params.id)) throw fail(404, "Player not found.");
  const result = decisionSchema.safeParse(req.body);
  if (!result.success)
    throw fail(400, "Choose approve or reject and enter a valid reason.");
  const { status, reason } = result.data;
  if (status === "rejected" && reason.length < 5)
    throw fail(400, "Give a clear rejection reason of at least 5 characters.");
  const existing = await Player.findById(req.params.id);
  if (!existing) throw fail(404, "Player not found.");
  const message =
    status === "approved"
      ? `Congratulations, ${existing.name}! Your details and payment have been verified for UGM Cricket Season 2. We will inform you soon about the auction dates.`
      : `Your UGM Cricket Season 2 registration was rejected. Reason: ${reason}`;
  const updated = await Player.findOneAndUpdate(
    { _id: req.params.id, status: "pending" },
    {
      $set: {
        status,
        rejectionReason: status === "rejected" ? reason : "",
        reviewedAt: new Date(),
        reviewedBy: req.user._id,
      },
      $push: {
        notifications: { kind: status, message, createdAt: new Date() },
      },
    },
    { returnDocument: "after" },
  );
  if (!updated)
    throw fail(
      409,
      "This application has already been reviewed. Refresh to see its current status.",
    );
  res.json({
    status: updated.status,
    message:
      "Decision saved. The player’s in-app notification has been created.",
  });
}
