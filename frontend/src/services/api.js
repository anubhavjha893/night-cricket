export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function retryDelay(ms, signal) {
  if (signal.aborted) throw signal.reason;
  await new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function api(
  endpoint,
  { method = "GET", body, signal, headers = {} } = {},
) {
  const startupRead =
    method === "GET" && ["/config", "/auth/me"].includes(endpoint);
  const deadline = AbortSignal.timeout(
    startupRead ? 60000 : body instanceof FormData ? 35000 : 15000,
  );
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let response;
  try {
    for (let attempt = 0; attempt < (startupRead ? 9 : 1); attempt++) {
      try {
        response = await fetch(`${API_BASE}/api${endpoint}`, {
          method,
          credentials: "include",
          signal: requestSignal,
          headers: {
            ...(body instanceof FormData
              ? {}
              : { "Content-Type": "application/json" }),
            ...headers,
          },
          body:
            body === undefined
              ? undefined
              : body instanceof FormData
                ? body
                : JSON.stringify(body),
        });
      } catch (error) {
        if (!startupRead || requestSignal.aborted || attempt === 8) throw error;
        await retryDelay(Math.min(1000 * 2 ** attempt, 10000), requestSignal);
        continue;
      }
      const temporary =
        response.status >= 500 ||
        (response.ok &&
          !response.headers.get("content-type")?.includes("application/json"));
      if (!startupRead || !temporary || attempt === 8) break;
      if (response.body) await response.body.cancel().catch(() => {});
      await retryDelay(Math.min(1000 * 2 ** attempt, 10000), requestSignal);
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    if (deadline.aborted)
      throw new ApiError(
        startupRead
          ? "The registration service is taking longer to start. Please wait a minute and retry."
          : "The request timed out. Please check your registration status before trying again.",
        504,
      );
    throw new ApiError(
      "The registration service is unavailable. Please try again shortly.",
      503,
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(
      "The registration service is temporarily unavailable or waking up. Please wait a minute and retry.",
      503,
    );
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.message || "Request failed. Please try again.",
      response.status,
      data.errors,
    );
  return data;
}
