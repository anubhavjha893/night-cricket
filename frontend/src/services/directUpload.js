import { api, API_BASE } from "./api";

export async function appendImage(body, field, file, signedIn) {
  const auth = await api(
    signedIn ? "/player/upload-ticket" : "/registrations/upload-ticket",
    { method: "POST", body: { purpose: field, mime: file.type } },
  );
  if (!auth.direct) {
    body.append(field, file);
    return;
  }
  const upload = new FormData();
  for (const [key, value] of Object.entries(auth.fields))
    upload.append(key, value);
  upload.append("token", auth.token);
  upload.append("file", file);
  const result = await fetch("https://upload.imagekit.io/api/v2/files/upload", {
    method: "POST",
    body: upload,
    signal: AbortSignal.timeout(90000),
  });
  if (!result.ok) throw new Error("Image upload failed. Please try again.");
  const { fileId } = await result.json();
  body.append(field + "Ref", JSON.stringify({ fileId, ticket: auth.ticket }));
}

export async function privatePhotoResponse(id, signal) {
  const response = await fetch(`${API_BASE}/api/files/${id}?delivery=url`, {
    credentials: "include",
    signal,
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  )
    return response;
  const { url } = await response.json();
  return fetch(url, { credentials: "omit", signal });
}
