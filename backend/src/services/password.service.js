import bcrypt from "bcrypt";
import { createHash } from "node:crypto";

export const PASSWORD_SCHEME = "sha256-bcrypt-v1";
// Keep disabled while any old instances are still running.
export const writePasswordScheme = (env) =>
  env.PASSWORD_SCHEME_ENABLED === "true" ? PASSWORD_SCHEME : undefined;
const digest = (password) =>
  createHash("sha256").update(password, "utf8").digest("hex");
const dummyHash =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.1GiCrgKvBjSLcNbTKO3du.4zOw7O2m2";
// Hash the complete input into 64 ASCII bytes so bcrypt never truncates it.
// Native async bcrypt runs on libuv workers rather than the request event loop.
export const hashPassword = (password, env = {}) =>
  bcrypt.hash(writePasswordScheme(env) ? digest(password) : password, 12);
export async function verifyPassword(password, record, env = {}) {
  if (!record) {
    await bcrypt.compare(digest(password), dummyHash);
    return false;
  }
  const value =
    record.passwordScheme === PASSWORD_SCHEME ? digest(password) : password;
  if (!(await bcrypt.compare(value, record.passwordHash))) return false;
  if (writePasswordScheme(env) && record.passwordScheme !== PASSWORD_SCHEME) {
    await record.constructor.updateOne(
      { _id: record._id, passwordHash: record.passwordHash },
      {
        $set: {
          passwordHash: await hashPassword(password, env),
          passwordScheme: PASSWORD_SCHEME,
        },
      },
    );
  }
  return true;
}
