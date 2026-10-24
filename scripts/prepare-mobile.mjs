import { copyFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "www");
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "creator-assistant.js",
  "editor-tools.js",
  "subtitle-tools.js",
  "ai-creator-tools.js",
  "memory-vault.js",
  "transcribe-worker.js"
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of files) {
  await copyFile(resolve(root, file), resolve(out, file));
}
console.log(`Prepared ${files.length} ClipSmith web assets for the Android package.`);
