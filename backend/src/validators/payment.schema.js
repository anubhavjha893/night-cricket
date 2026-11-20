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
  auctionDate: z
    .string()
    .refine((value) => {
      if (value === "") return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(`${value}T00:00:00Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Enter a valid auction date.")
    .optional(),
});
