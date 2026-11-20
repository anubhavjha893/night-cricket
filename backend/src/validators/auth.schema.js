import { z } from "zod";
import { phoneSchema } from "./common.schema.js";

export const playerLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().max(128),
});
export const adminLoginSchema = z.object({
  email: z.email(),
  password: z.string().max(128),
});
