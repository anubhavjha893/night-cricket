import jwt from "jsonwebtoken";
import { SESSION_COOKIE } from "../config/auth.js";

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
    });
    res.cookie(SESSION_COOKIE, token, sessionCookie);
  }

  function clearSession(res) {
    res.clearCookie(SESSION_COOKIE, { ...sessionCookie, maxAge: undefined });
  }
  return { setSession, clearSession };
}
