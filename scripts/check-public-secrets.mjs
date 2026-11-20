import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

const directory = path.resolve("frontend/dist");
let values = {};
try {
  values = dotenv.parse(await readFile("backend/.env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const privateValues = ["JWT_SECRET", "ADMIN_PASSWORD", "MONGODB_URI"]
  .map((name) => values[name])
  .filter((value) => value?.length >= 12);
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(js|css|html|json)$/.test(entry.name)) files.push(file);
  }
}
await walk(directory);
let leaks = 0;
for (const file of files) {
  const content = await readFile(file, "utf8");
  if (
    privateValues.some((value) => content.includes(value)) ||
    /mongodb(?:\+srv)?:\/\/[^\s"']+@/.test(content)
  )
    leaks++;
}
if (leaks) {
  console.error(
    "FAIL: possible private credential content in public build. Values withheld.",
  );
  process.exitCode = 1;
} else
  console.log(
    `PASS: ${files.length} public text assets scanned; no configured private credentials or authenticated MongoDB URLs found.`,
  );
