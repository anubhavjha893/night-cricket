import rateLimit from "express-rate-limit";

export const createLoginLimiter = () =>
  rateLimit({
    windowMs: 15 * 60000,
    limit: 12,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      message: "Too many login attempts. Please try again after 15 minutes.",
    },
  });
export const createSubmissionLimiter = () =>
  rateLimit({
    windowMs: 60 * 60000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many applications. Please try again later." },
  });
