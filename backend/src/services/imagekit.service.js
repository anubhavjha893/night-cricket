import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createHmac, randomUUID } from "node:crypto";
import { fail } from "../utils/http-error.js";

const formats = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const assets = () => mongoose.connection.db.collection("imagekitAssets");
const folder = "/tournament/players";
export function issueUpload(req, res) {
  const env = req.app.locals.mediaEnv;
  if (
    !env.IMAGEKIT_PRIVATE_KEY &&
    !env.IMAGEKIT_PUBLIC_KEY &&
    !env.IMAGEKIT_URL_ENDPOINT
  )
    return res.json({ direct: false });
  if (
    !env.IMAGEKIT_PRIVATE_KEY ||
    !env.IMAGEKIT_PUBLIC_KEY ||
    !/^https:\/\/ik\.imagekit\.io\/[\w-]+\/?$/.test(env.IMAGEKIT_URL_ENDPOINT)
  )
    throw fail(503, "Image storage configuration is incomplete.");
  const { purpose, mime } = req.body;
  if (!["playerPhoto", "paymentProof"].includes(purpose) || !formats.has(mime))
    throw fail(400, "Choose a JPG, PNG or WebP image.");
  const fileName = randomUUID() + "." + formats.get(mime);
  const fields = {
    fileName,
    folder,
    useUniqueFileName: "false",
    overwriteFile: "false",
    isPrivateFile: "true",
    checks: `"file.size" <= "5mb" AND "file.mime" = "${mime}"`,
  };
  const token = jwt.sign(fields, env.IMAGEKIT_PRIVATE_KEY, {
    expiresIn: 180,
    keyid: env.IMAGEKIT_PUBLIC_KEY,
  });
  const ticket = jwt.sign(
    { fileName, purpose, mime, owner: String(req.user?._id || "") },
    env.JWT_SECRET,
    { audience: "image-claim", expiresIn: "20m" },
  );
  res.json({ direct: true, fields, token, ticket });
}
function remote(id, env, method = "GET") {
  return fetch(
    "https://api.imagekit.io/v1/files/" +
      encodeURIComponent(id) +
      (method === "GET" ? "/details" : ""),
    {
      method,
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(env.IMAGEKIT_PRIVATE_KEY + ":").toString("base64"),
      },
      signal: AbortSignal.timeout(12000),
    },
  );
}
export async function acceptUpload(req, field) {
  const ref = req.body?.[field + "Ref"];
  if (!ref) return;
  const env = req.app.locals.mediaEnv;
  let claim, fileId;
  try {
    const data = JSON.parse(ref);
    fileId = data.fileId;
    claim = jwt.verify(data.ticket, env.JWT_SECRET, {
      algorithms: ["HS256"],
      audience: "image-claim",
    });
  } catch {
    throw fail(400, "Invalid or expired upload. Select the file again.");
  }
  if (
    claim.purpose !== field ||
    claim.owner !== String(req.user?._id || "") ||
    !/^[a-f\d]{24}$/i.test(fileId)
  )
    throw fail(400, "Upload does not match this submission.");
  const result = await remote(fileId, env);
  if (!result.ok) throw fail(400, "Uploaded image could not be verified.");
  const info = await result.json();
  if (
    info.filePath !== folder + "/" + claim.fileName ||
    info.isPrivateFile !== true ||
    info.fileType !== "image" ||
    !(info.size > 0 && info.size <= 5242880)
  )
    throw fail(400, "Uploaded image does not match its authorization.");
  return {
    remoteAsset: {
      _id: new mongoose.Types.ObjectId(fileId),
      path: info.filePath,
    },
  };
}
export async function storeRemote(asset) {
  await assets().insertOne(asset);
  return asset._id;
}
export async function removeRemote(id, env) {
  const asset = await assets().findOne({ _id: id });
  if (!asset) return false;
  const result = await remote(String(id), env, "DELETE");
  if (result.ok || result.status === 404) await assets().deleteOne({ _id: id });
  return true;
}
export async function delivery(id, res) {
  const env = res.app.locals.mediaEnv;
  const asset = await assets().findOne({ _id: id });
  if (!asset) return false;
  if (!env.IMAGEKIT_PRIVATE_KEY || !env.IMAGEKIT_URL_ENDPOINT)
    throw fail(503, "Image storage unavailable.");
  const expiry = Math.floor(Date.now() / 1000) + 120;
  const signature = createHmac("sha1", env.IMAGEKIT_PRIVATE_KEY)
    .update(asset.path.slice(1) + expiry)
    .digest("hex");
  const url =
    env.IMAGEKIT_URL_ENDPOINT.replace(/\/$/, "") +
    asset.path +
    "?ik-t=" +
    expiry +
    "&ik-s=" +
    signature;
  res.set("Cache-Control", "private, no-store");
  if (res.req.query.delivery === "url") res.json({ url });
  else res.redirect(302, url);
  return true;
}
