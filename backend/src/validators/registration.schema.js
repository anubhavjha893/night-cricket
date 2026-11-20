import { z } from "zod";
import { phoneSchema } from "./common.schema.js";

export const registrationSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100),
  age: z.coerce
    .number()
    .int()
    .min(5, "Age must be between 5 and 100.")
    .max(100),
  phone: phoneSchema,
  address: z.string().trim().min(10, "Enter your complete address.").max(1000),
  roles: z
    .array(z.enum(["Batter", "Bowler", "All-rounder", "Wicketkeeper"]))
    .min(1, "Choose at least one player role.")
    .max(4),
  tshirtSize: z.enum(["XS", "S", "M", "L", "XL", "XXL"]),
  password: z
    .string()
    .min(8, "Use a password with at least 8 characters.")
    .max(128),
  transactionReference: z
    .string()
    .trim()
    .min(6, "Enter the payment transaction reference / UTR.")
    .max(64)
    .regex(
      /^[a-zA-Z0-9-]+$/,
      "Use only letters, digits or hyphens in the transaction reference.",
    )
    .transform((v) => v.toUpperCase()),
  declaration: z.literal("true", { error: "Please accept the declaration." }),
});
