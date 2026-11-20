// Per-process admission: no unbounded upload/password-work queue.
export function createWorkGate(limit = 4) {
  let active = 0;
  function middleware(req, res, next) {
    if (active >= limit)
      return res.set("Retry-After", "2").status(503).json({
        message: "The server is busy. Please retry in 2 seconds.",
        retryAfterSeconds: 2,
      });
    active++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        active--;
      }
    };
    const lease = { started: false, release };
    req.workLease = lease;
    // A disconnected client must not free a still-running password/DB task.
    const releaseBeforeHandler = () => {
      if (!lease.started) release();
    };
    res.once("finish", releaseBeforeHandler);
    res.once("close", releaseBeforeHandler);
    next();
  }
  return { middleware, active: () => active, limit };
}
export const runWork = (handler) => async (req, res, next) => {
  const lease = req.workLease;
  if (lease) lease.started = true;
  try {
    return await handler(req, res, next);
  } finally {
    lease?.release();
  }
};
