import jwt from "jsonwebtoken";
import { SESSION_COOKIE } from "../config/auth.js";
import { createHash, randomUUID } from "node:crypto";
import { RevokedSession } from "../models/RevokedSession.js";
export const sessionDigest = (token) =>
  createHash("sha256").update(token).digest("hex");

export function createSessionService(env) {
  const production = env.NODE_ENV === "production";
  const sessionCookie = {
    httpOnly: true,
    secure: production,
    sameSite: env.COOKIE_SAME_SITE || "lax",
    maxAge: 7 * 86400000,
    path: "/",
  };
  function setSession(res, user, role) {
    const token = jwt.sign({ sub: String(user._id), role }, env.JWT_SECRET, {
      expiresIn: "7d",
      issuer: "ugm-cricket",
      audience: "ugm-players",
      jwtid: randomUUID(),
    });
    res.cookie(SESSION_COOKIE, token, sessionCookie);
  }

  async function clearSession(res, token) {
    if (token) {
      let payload;
      try {
        payload = jwt.verify(token, env.JWT_SECRET, {
          issuer: "ugm-cricket",
          audience: "ugm-players",
          algorithms: ["HS256"],
        });
      } catch {}
      if (payload?.exp)
        await RevokedSession.updateOne(
          { _id: sessionDigest(token) },
          { $set: { expiresAt: new Date(payload.exp * 1000) } },
          { upsert: true, maxTimeMS: 1000 },
        );
    }
    res.clearCookie(SESSION_COOKIE, { ...sessionCookie, maxAge: undefined });
  }
  return { setSession, clearSession };
}
