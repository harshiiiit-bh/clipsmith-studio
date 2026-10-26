import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getImportKind, getVideoMimeType, getVideoFileExtension, formatMediaBytes } from "../media-import.js";

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
assert.equal(getVideoFileExtension("episode.MKV"), "mkv", "export source filenames preserve their actual extension");
assert.equal(getVideoFileExtension("source video.m2ts"), "m2ts", "multi-part video extensions are preserved");
assert.equal(getVideoFileExtension("video-without-extension"), "mp4", "unknown extensions keep a predictable fallback");
assert.equal(getVideoMimeType("episode.mp4"), "video/mp4");
assert.equal(formatMediaBytes(1024), "1.00 KB");
assert.equal(formatMediaBytes(1024 * 1024), "1.00 MB");

assert.match(html, /id="videoInput" type="file" accept="\*\/\*"/, "the picker must not hide ZIP or uncommon video files with a narrow accept filter");
assert.match(html, /ZIP archives\. Open a ZIP and choose one episode without extracting the whole folder/i);
assert.match(html, /studio-2\.css\?v=[^"]+"/);
assert.match(html, /app\.js\?v=[^"]+"/);
assert.match(app, /aspectTargets\.forEach\(el=>\{if\(el\)el\.dataset\.aspect=aspect\}\)/,
  "the selected aspect ratio should drive the editor workspace layout as well as the canvas");

assert.match(html, /id="timeline"/, "the unified clip sequence exists");
assert.doesNotMatch(html, /id="clipStripSlider"/, "the duplicate clip browser slider is removed");
assert.doesNotMatch(html, /class="clip-strip-section"/, "there is only one clip navigation panel");
assert.match(html, /class="scene-scan-stack"/);
assert.match(css, /grid-template-rows: auto minmax\(0,auto\) minmax\(64px,1fr\) !important;/,
  "the unified timeline uses one non-overlapping sequence row");
assert.match(app, /function renderTimeline\(\)[\s\S]*?e\.draggable=true/,
  "each timeline clip remains selectable and draggable");
assert.match(app, /reorderClip\(state\.clips,from,c\.id/,
  "drag-and-drop reorders clips in the single sequence");
assert.match(app, /timeline\.scrollTo\(\{left:/,
  "moving selection into view works with the unified timeline");
assert.match(app, /chooseVideoFromZip/);
assert.match(app,/async function readBlobWithLimit\(response,maxBytes\)/,"direct URL imports use a bounded streaming reader");
assert.match(app,/if\(bytesRead>maxBytes\)/,"the streaming reader cancels responses as soon as they exceed the 300 MB cap");
assert.match(app,/advertisedBytes>maxUrlBytes/,"declared Content-Length is rejected before download");
assert.ok(app.indexOf("if(mime.includes('text/html'))")<app.indexOf("readBlobWithLimit(r,maxUrlBytes)"),"HTML webpages are rejected before any response body is buffered");
assert.match(app, /recoverPreviewCompatibility/, "decoder failures should launch compatibility recovery");
assert.match(app,/getVideoMimeType\(name,blob\.type\|\|mime\)/,"direct video links infer a usable video MIME type from the filename when the server sends a generic type");
assert.match(app, /libx264/);
assert.ok(app.includes('getVideoFileExtension(file.name||"video.mp4")'), "the FFmpeg source cache uses the shared extension parser");
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
assert.match(importer,/onBeforeExtract = async \(\) => true/,"ZIP extraction accepts a pre-allocation memory guard");
assert.match(importer,/const allowed = await onBeforeExtract\(\{ fileSize: size, filename: entry\.filename \}\)/,"the memory guard runs before the selected ZIP entry is extracted");
assert.match(app,/onBeforeExtract:\(\{fileSize\}\)=>\{if\(!memorySafeMode\)return true;const warning=getMediaMemoryWarning/,"large ZIP episodes use the same device memory guidance before extraction");
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



assert.ok(app.includes("await loadFile(episode,{memoryCheckConfirmed:true})"), "a ZIP entry accepted at preflight should not prompt twice");
assert.ok(app.includes("if(memorySafeMode&&!memoryCheckConfirmed)"), "ordinary local files must still receive memory safety warnings");
console.log("Media import smoke checks passed.");
