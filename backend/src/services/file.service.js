import mongoose from "mongoose";
import { fileTypeFromBuffer } from "file-type";

export function fileBucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "uploads",
  });
}

export async function checkImage(file, label) {
  if (!file)
    throw Object.assign(new Error(`${label} is required.`), { status: 400 });
  let type;
  try {
    type = await fileTypeFromBuffer(file.buffer);
  } catch {}
  if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type.mime)) {
    throw Object.assign(
      new Error(`${label} must be a valid JPG, PNG or WebP image.`),
      { status: 400 },
    );
  }
  return { ...file, verifiedType: type.mime, extension: type.ext };
}

export function saveImage(file, purpose) {
  return new Promise((resolve, reject) => {
    const stream = fileBucket().openUploadStream(
      `${purpose}.${file.extension}`,
      {
        metadata: { contentType: file.verifiedType, purpose },
      },
    );
    stream.on("error", async (error) => {
      await stream.abort().catch(() => {});
      reject(error);
    });
    stream.on("finish", () => resolve(stream.id));
    stream.end(file.buffer);
  });
}

export async function deleteImage(id) {
  if (id)
    await fileBucket()
      .delete(id)
      .catch(() => {});
}

export async function sendImage(id, res) {
  const objectId = new mongoose.Types.ObjectId(String(id));
  const [file] = await fileBucket().find({ _id: objectId }).toArray();
  if (!file) return res.status(404).json({ message: "Image not found." });
  res.set({
    "Content-Type": file.metadata.contentType,
    "Content-Length": String(file.length),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="${file.filename}"`,
  });
  const stream = fileBucket().openDownloadStream(objectId);
  const deadline = setTimeout(() => {
    stream.destroy();
    res.destroy();
  }, 15000);
  deadline.unref();
  res.once("finish", () => clearTimeout(deadline));
  stream.on("error", () => res.destroy());
  res.on("close", () => {
    clearTimeout(deadline);
    stream.destroy();
  });
  stream.pipe(res);
}
