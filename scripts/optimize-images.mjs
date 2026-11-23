import sharp from "sharp";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const assets = fileURLToPath(
  new URL("../frontend/public/assets/", import.meta.url),
);
const summary = [];
for (const [name, extension, fullWidth] of [
  ["night-stadium", "jpg", 1200],
  ["season-1-welcome", "png", 1536],
  ["season-1-trophy", "png", 1536],
]) {
  const source = path.join(assets, `${name}.${extension}`);
  const sizes = {};
  for (const width of [420, 640, 960, fullWidth]) {
    const filename = `${name}${width === fullWidth ? "" : `-${width}`}.webp`;
    const encoded = await sharp(source)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 70, effort: 6 })
      .toFile(path.join(assets, filename));
    sizes[width] = {
      bytes: encoded.size,
      width: encoded.width,
      height: encoded.height,
    };
  }
  summary.push({
    image: name,
    originalBytes: (await stat(source)).size,
    variants: sizes,
  });
}
console.log(JSON.stringify(summary, null, 2));
