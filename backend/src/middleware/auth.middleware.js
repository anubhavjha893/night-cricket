import jwt from "jsonwebtoken";
import { Admin, Player } from "../models/index.js";
import { fail } from "../utils/http-error.js";
import { idIsValid } from "../utils/object-id.js";
import { SESSION_COOKIE } from "../config/auth.js";

export function createAuthMiddleware(env) {
  async function requireUser(req, res, next) {
    let payload;
    try {
      payload = jwt.verify(req.cookies[SESSION_COOKIE], env.JWT_SECRET, {
        issuer: "ugm-cricket",
        audience: "ugm-players",
        algorithms: ["HS256"],
      });
    } catch {
      throw fail(401, "Please sign in to continue.");
    }
    if (!idIsValid(payload.sub) || !["player", "admin"].includes(payload.role))
      throw fail(401, "Please sign in again.");
    const user = await (payload.role === "admin" ? Admin : Player).findById(
      payload.sub,
    );
    if (!user)
      throw fail(401, "Your session is no longer valid. Please sign in.");
    req.user = user;
    req.role = payload.role;
    next();
  }
  return requireUser;
}

export function requireAdmin(req, res, next) {
  if (req.role !== "admin")
    throw fail(403, "Administrator access is required.");
  next();
}
