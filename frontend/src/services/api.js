export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export async function api(endpoint, { method = "GET", body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}/api${endpoint}`, {
      method,
      credentials: "include",
      signal,
      headers:
        body instanceof FormData ? {} : { "Content-Type": "application/json" },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(
      "The registration service is unavailable. Please try again shortly.",
      503,
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(
      "The registration service is not connected yet. Please try again later.",
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
