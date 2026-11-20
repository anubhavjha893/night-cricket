import {
  playerLoginSchema,
  adminLoginSchema,
} from "../validators/auth.schema.js";
import bcrypt from "bcryptjs";
import { Admin, Player } from "../models/index.js";

import { fail } from "../utils/http-error.js";

export function createAuthController(session) {
  async function loginPlayer(req, res) {
    const parsed = playerLoginSchema.safeParse(req.body);
    if (!parsed.success)
      throw fail(400, "Enter your mobile number and password.");
    const player = await Player.findOne({ phone: parsed.data.phone }).select(
      "+passwordHash",
    );
    const valid = player
      ? await bcrypt.compare(parsed.data.password, player.passwordHash)
      : await bcrypt.compare(
          parsed.data.password,
          "$2b$12$C6UzMDM.H6dfI/f/IKcEe.1GiCrgKvBjSLcNbTKO3du.4zOw7O2m2",
        );
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
    }).select("+passwordHash");
    const valid = admin
      ? await bcrypt.compare(result.data.password, admin.passwordHash)
      : await bcrypt.compare(
          result.data.password,
          "$2b$12$C6UzMDM.H6dfI/f/IKcEe.1GiCrgKvBjSLcNbTKO3du.4zOw7O2m2",
        );
    if (!admin || !valid) throw fail(401, "Email or password is incorrect.");
    session.setSession(res, admin, "admin");
    res.json({ role: "admin", email: admin.email });
  }

  function logout(req, res) {
    session.clearSession(res);
    res.json({ ok: true });
  }
  function getSession(req, res) {
    res.json({ role: req.role, name: req.user.name, email: req.user.email });
  }
  return { loginPlayer, loginAdmin, logout, getSession };
}
