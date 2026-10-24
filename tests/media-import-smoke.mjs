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
const workspaceControls = readFileSync(new URL("workspace-controls.js", root), "utf8");
const worker = readFileSync(new URL("ffmpeg/worker.js", root), "utf8");
const workerConst = readFileSync(new URL("ffmpeg/const.js", root), "utf8");
const workerErrors = readFileSync(new URL("ffmpeg/errors.js", root), "utf8");

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
assert.match(html, /studio-2\.css\?v=20261024-ratiowork2/);
assert.match(html, /app\.js\?v=20261024-ratiowork2/);
assert.match(app, /aspectTargets\.forEach\(el=>\{if\(el\)el\.dataset\.aspect=aspect\}\)/,
  "the selected aspect ratio should drive the editor workspace layout as well as the canvas");

assert.match(html, /id="clipStripSlider"[^>]*aria-label="Slide through clips"/,
  "the clip browser needs a visible range slider");
assert.match(html, /id="clipStripPrevBtn"/);
assert.match(html, /id="clipStripNextBtn"/);
assert.match(html, /class="scene-scan-stack"/);
assert.match(html, /class="clip-strip-section"/);
assert.match(css, /grid-template-rows: auto minmax\(0, auto\) 56px minmax\(82px, 1fr\) !important;/,
  "scene scan, source timeline and clip cards need explicit non-overlapping grid rows");
assert.match(css, /gap: 12px !important;/, "clip cards should have real spacing");
assert.match(css, /flex: 0 0 160px !important;/, "each clip should have its own fixed-width card");
assert.match(app, /function syncClipStripSlider\(\)/);
assert.match(app, /strip\.scrollBy\(\{left:direction\*step,behavior:/,
  "prev/next controls should slide the clip strip horizontally");
assert.match(app, /strip\.scrollLeft=\(Number\(slider\.value\)\/1000\)\*maxScroll/,
  "the range slider should move through the horizontal clip strip");
assert.match(app, /requestAnimationFrame\(\(\)=>scrollClipCardIntoView\(id\)\)/,
  "selecting a clip should bring that card into view");

assert.match(app, /chooseVideoFromZip/);
assert.match(app, /recoverPreviewCompatibility/, "decoder failures should launch compatibility recovery");
assert.match(app, /libx264/);
assert.match(app, /original source retained for export/i);

assert.match(app, /function syncPlaybackClip\(time\)/,
  "the active clip should follow the playhead while the video plays");
assert.match(app, /syncPlaybackClip\(v\.currentTime\);updateActiveSubtitle\(\)/,
  "time updates should switch the active part without interrupting playback");
assert.doesNotMatch(app, /if\(c&&!v\.paused&&v\.currentTime>=c\.end\)\{v\.pause\(\)/,
  "clip boundaries must never pause whole-source playback");
assert.doesNotMatch(app, /if\(c&&v\.currentTime>=c\.end\)v\.currentTime=c\.start/,
  "resuming playback must not jump backward to the selected part");
assert.match(app, /\$\("previewVideo"\)\.onplay=/, "play control should follow the real media playing state");
assert.match(app, /\$\("previewVideo"\)\.onended=/, "the play control should reset only at the end of the full source");
assert.match(app, /e\.dataset\.clipId=c\.id;/, "timeline segments need stable clip IDs for live selection highlighting");

assert.match(importer, /new ZipReader\(new BlobReader\(file\)\)/, "archive indexing should seek through the selected local File");
assert.match(importer, /entry\.getData\(new BlobWriter\(mime\)/, "only the selected entry should be extracted");
assert.match(importer, /entry\.uncompressedSize/);
assert.match(importer, /password-protected or encrypted/);
assert.match(css, /\.archive-picker-backdrop/);
assert.match(css, /\.archive-episode-row\.selected/);
assert.match(mobilePrepare, /"media-import\.js"/, "Android WebView must include the importer module");
assert.equal((workflow.match(/- "media-import\.js"/g) || []).length, 2, "Android CI should watch the module for push and pull requests");
assert.match(packageJson.scripts["check:mobile"], /tests\/media-import-smoke\.mjs/);

assert.ok(app.includes('classWorkerURL:new URL("./ffmpeg/worker.js?v=20261024-workerfix1",import.meta.url).href'),
  "FFmpeg must use the site's same-origin root worker instead of a CDN worker");
assert.match(worker, /from "\.\/const\.js"/);
assert.match(worker, /from "\.\/errors\.js"/);
assert.match(worker, /self\.onmessage/);
assert.match(worker, /createFFmpegCore/);
assert.match(workerConst, /FFMessageType/);
assert.match(workerErrors, /ERROR_IMPORT_FAILURE/);
assert.match(mobilePrepare, /cp\(path\.join\(root,"ffmpeg"\),path\.join\(out,"ffmpeg"\),\{recursive:true\}\)/,
  "Android packaging must copy the local FFmpeg worker and helper modules");
assert.equal((workflow.match(/- "ffmpeg\/\*\*"/g) || []).length, 2,
  "Android CI should watch same-origin worker files for pushes and pull requests");
assert.match(css, /\.timeline-block \{\s*min-width: 62px !important;/);
assert.match(css, /grid-template-rows: minmax\(0, 1fr\) clamp\(216px, 29vh, 248px\) !important;/);
assert.match(app, /dataset\.baseWidth=String\(baseWidth\);e\.style\.width=\`\$\{baseWidth\}px\`;/,
  "timeline segments should keep a readable pixel width instead of collapsing to percentages");
assert.match(workspaceControls, /Math\.max\(62, Math\.round\(baseWidth \* zoom\)\)\}px/,
  "timeline zoom should scale actual segment widths");



console.log("Media import smoke checks passed.");
