import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getImportKind, getVideoMimeType, formatMediaBytes } from "../media-import.js";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const app = readFileSync(new URL("app.js", root), "utf8");
const importer = readFileSync(new URL("media-import.js", root), "utf8");
const css = readFileSync(new URL("studio-2.css", root), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const mobilePrepare = readFileSync(new URL("scripts/prepare-mobile.mjs", root), "utf8");
const workflow = readFileSync(new URL(".github/workflows/android-apk.yml", root), "utf8");

for (const name of ["episode.mp4", "episode.mkv", "episode.avi", "episode.mov", "episode.webm", "episode.mts", "episode.3gp"]) {
  assert.equal(getImportKind({ name, type: "" }), "video", name + " should be recognized independent of MIME type");
}
assert.equal(getImportKind({ name: "Season 5.zip", type: "application/x-zip-compressed" }), "zip");
assert.equal(getImportKind({ name: "folder.7z", type: "application/x-7z-compressed" }), "unsupported-archive");
assert.equal(getImportKind({ name: "camera-file", type: "video/mp4" }), "video", "video MIME types should be accepted even without an extension");
assert.equal(getImportKind({ name: "notes.pdf", type: "application/pdf" }), "unsupported");
assert.equal(getVideoMimeType("episode.mkv"), "video/x-matroska");
assert.equal(getVideoMimeType("episode.mp4"), "video/mp4");
assert.equal(formatMediaBytes(1024), "1.00 KB");
assert.equal(formatMediaBytes(1024 * 1024), "1.00 MB");

assert.match(html, /id="videoInput" type="file" accept="\*\/\*"/, "the picker must not hide ZIP or uncommon video files with a narrow accept filter");
assert.match(html, /ZIP archives\. Open a ZIP and choose one episode without extracting the whole folder/i);
assert.match(html, /studio-2\.css\?v=20261024-zipimport1/);
assert.match(html, /app\.js\?v=20261024-zipimport1/);
assert.match(app, /chooseVideoFromZip/);
assert.match(app, /recoverPreviewCompatibility/, "decoder failures should launch compatibility recovery");
assert.match(app, /libx264/);
assert.match(app, /original source retained for export/i);
assert.match(importer, /new ZipReader\(new BlobReader\(file\)\)/, "archive indexing should seek through the selected local File");
assert.match(importer, /entry\.getData\(new BlobWriter\(mime\)/, "only the selected entry should be extracted");
assert.match(importer, /entry\.uncompressedSize/);
assert.match(importer, /password-protected or encrypted/);
assert.match(css, /\.archive-picker-backdrop/);
assert.match(css, /\.archive-episode-row\.selected/);
assert.match(mobilePrepare, /"media-import\.js"/, "Android WebView must include the importer module");
assert.equal((workflow.match(/- "media-import\.js"/g) || []).length, 2, "Android CI should watch the module for push and pull requests");
assert.match(packageJson.scripts["check:mobile"], /tests\/media-import-smoke\.mjs/);

console.log("Media import smoke checks passed.");
