import { z } from "zod";

export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s()-]/g, "").replace(/^(\+91|0091)/, ""))
  .pipe(
    z
      .string()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
  );
