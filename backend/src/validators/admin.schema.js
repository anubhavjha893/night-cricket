import { z } from "zod";

export const decisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(1000).default(""),
  submissionRevision: z.number().int().min(0).optional(),
});
