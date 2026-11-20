import multer from "multer";

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError)
    return res
      .status(400)
      .json({
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Each image must be 5 MB or smaller."
            : "Please upload only the requested images and fields.",
      });
  if (error.code === 11000)
    return res
      .status(409)
      .json({
        message:
          "This mobile number or payment reference is already registered. Sign in or contact the organiser.",
      });
  const status = error.status || 500;
  if (status >= 500) console.error("Request failed:", error.name);
  res
    .status(status)
    .json({
      message:
        status >= 500
          ? error.status
            ? error.message
            : "Something went wrong. Please try again."
          : error.message,
    });
}
