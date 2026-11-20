import { z } from "zod";

export const paymentSettingsSchema = z.object({
  payeeName: z.string().trim().min(2).max(100),
  upiId: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .regex(/^[\w.\-]{2,256}@[a-zA-Z0-9.\-]{2,64}$/, "Enter a valid UPI ID."),
  ]),
  registrationMode: z.enum(["scheduled", "open", "closed"]),
  removeQr: z.enum(["true", "false"]).default("false"),
});
