import multer from "multer";

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === "entity.parse.failed")
    return res
      .status(400)
      .json({ message: "Request body must contain valid JSON." });
  if (error.type === "entity.too.large")
    return res
      .status(413)
      .json({ message: "Request body exceeds the allowed size." });
  if (
    [
      "MongoServerSelectionError",
      "MongoNetworkError",
      "MongoNetworkTimeoutError",
      "MongoWaitQueueTimeoutError",
    ].includes(error.name) ||
    error.code === 50
  )
    return res.set("Retry-After", "2").status(503).json({
      message: "The database is temporarily unavailable. Please retry.",
      retryAfterSeconds: 2,
    });
  if (error instanceof multer.MulterError)
    return res.status(400).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Each image must be 5 MB or smaller."
          : "Please upload only the requested images and fields.",
    });
  if (error.code === 11000)
    return res.status(409).json({
      message:
        "This mobile number or payment reference is already registered. Sign in or contact the organiser.",
    });
  const status = error.status || 500;
  if (status >= 500)
    console.error(
      JSON.stringify({
        event: "request_failed",
        requestId: req.requestId,
        type: error.name,
      }),
    );
  res.status(status).json({
    message:
      status >= 500
        ? error.status
          ? error.message
          : "Something went wrong. Please try again."
        : error.message,
  });
}
