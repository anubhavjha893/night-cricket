import {
  playerLoginSchema,
  adminLoginSchema,
} from "../validators/auth.schema.js";
import { verifyPassword } from "../services/password.service.js";
import { Admin, Player } from "../models/index.js";

import { fail } from "../utils/http-error.js";
import { SESSION_COOKIE } from "../config/auth.js";

export function createAuthController(session, env) {
  async function loginPlayer(req, res) {
    const parsed = playerLoginSchema.safeParse(req.body);
    if (!parsed.success)
      throw fail(400, "Enter your mobile number and password.");
    const player = await Player.findOne({ phone: parsed.data.phone }).select(
      "+passwordHash +passwordScheme",
    );
    const valid = await verifyPassword(parsed.data.password, player, env);
    if (!player || !valid)
      throw fail(401, "Mobile number or password is incorrect.");
    session.setSession(res, player, "player");
    res.json({ role: "player", name: player.name });
  }

  async function loginAdmin(req, res) {
    const result = adminLoginSchema.safeParse(req.body);
    if (!result.success)
      throw fail(400, "Enter your admin email and password.");
    const admin = await Admin.findOne({
      email: result.data.email.toLowerCase(),
    }).select("+passwordHash +passwordScheme");
    const valid = await verifyPassword(result.data.password, admin, env);
    if (!admin || !valid) throw fail(401, "Email or password is incorrect.");
    session.setSession(res, admin, "admin");
    res.json({ role: "admin", email: admin.email });
  }

  async function logout(req, res) {
    await session.clearSession(res, req.cookies[SESSION_COOKIE]);
    res.json({ ok: true });
  }
  function getSession(req, res) {
    res.json({ role: req.role, name: req.user.name, email: req.user.email });
  }
  return { loginPlayer, loginAdmin, logout, getSession };
}
