import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Sites needs a root dist/ directory. Application builds belong to frontend/dist/.
const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.resolve(root, "frontend/dist");
const destination = path.resolve(root, "dist");
if (
  path.dirname(destination) !== path.resolve(root) ||
  path.basename(destination) !== "dist"
) {
  throw new Error(
    "Refusing to replace a directory outside this project’s build output.",
  );
}
if (!existsSync(path.join(source, "index.html")))
  throw new Error("Build frontend/ before preparing the hosting artifact.");
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });
console.log("Prepared Sites hosting artifact: dist/ (from frontend/dist/).");
