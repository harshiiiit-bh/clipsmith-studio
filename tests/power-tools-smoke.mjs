import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const html = read("index.html");
const app = read("app.js");
const workspace = read("workspace-controls.js");
const tools = read("power-tools.js");
const guard = read("runtime-guard.js");
const css = read("studio-2.css");
const mobilePrepare = read("scripts/prepare-mobile.mjs");
const smokeWorkflow = read(".github/workflows/clip-smoke.yml");
const androidWorkflow = read(".github/workflows/android-apk.yml");

const ids = [
  "powerToolsBtn", "powerToolsMobileBtn", "powerToolsModal", "closePowerToolsBtn",
  "powerFrameRate", "powerTimecodeInput", "powerGoTimeBtn", "powerPreviousFrameBtn",
  "powerNextFrameBtn", "powerLoopBtn", "powerMarkerLabel", "powerSaveMarkerBtn",
  "powerMarkerList", "presetShortsBtn", "presetYouTubeBtn", "presetSquareBtn",
  "presetFeedBtn", "powerSpeedSelect", "powerMuteBtn", "powerSnapshotBtn",
  "powerCopyTimeBtn", "powerTitleTemplate", "powerApplyTitleBtn", "powerCaptionTemplate",
  "powerApplyCaptionBtn", "powerCopyCaptionBtn", "powerResetEffectsBtn",
  "powerExportSelectedBtn", "powerExportPrefix"
];
for (const id of ids) assert.ok(html.includes('id="' + id + '"'), id + " exists");

assert.ok(html.indexOf('src="./runtime-guard.js?v=20261024-power3"') < html.indexOf('src="./app.js?v=20261024-overlaysfix5"'),
  "startup diagnostics load before the editor module");
assert.match(guard, /addEventListener\(["']error["']/);
assert.match(guard, /unhandledrejection/);
assert.match(guard, /clipsmith:app-ready/);
assert.match(app, /clipsmith:app-ready/);
assert.match(app, /setPreviewMuted/);
assert.match(app, /exportSelectedClip/);
assert.match(app, /powerExportPrefix/);
assert.match(tools, /powerToolsModal/);
assert.match(tools, /powerMarkerList/);
assert.match(tools, /presetShortsBtn/);
assert.match(tools, /powerFrameRate/);
assert.match(tools, /powerSnapshotBtn/);
assert.ok(html.includes('id="powerFilenamePreview"'), "filename preview exists");
assert.match(tools, /Alt\+P|event\.altKey/);
assert.match(workspace, /Open Creator Power Tools/);
assert.match(css, /\.power-tools-scrim/);
assert.match(css, /grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
assert.ok(mobilePrepare.includes('"runtime-guard.js"'), "mobile bundle includes startup diagnostics");
assert.ok(mobilePrepare.includes('"power-tools.js"'), "mobile bundle includes Creator Power Tools");
assert.ok(smokeWorkflow.includes('node --check power-tools.js'));
assert.ok(smokeWorkflow.includes('node --check runtime-guard.js'));
assert.ok(smokeWorkflow.includes('node tests/power-tools-smoke.mjs'));
assert.ok(androidWorkflow.includes('- "power-tools.js"'));
assert.ok(androidWorkflow.includes('- "runtime-guard.js"'));

for (const file of ["index.html", "app.js", "workspace-controls.js", "power-tools.js", "runtime-guard.js"]) {
  const source = file === "app.js" ? app : file === "workspace-controls.js" ? workspace : file === "power-tools.js" ? tools : file === "runtime-guard.js" ? guard : html;
  assert.doesNotMatch(source, /20261024-runtime1|20261024-cs3|20261024-ai1|20261024-ai2|20261024-mem1/,
    file + " must not refer to stale mixed release cache keys");
}
console.log("ClipSmith Creator Power Tools smoke checks passed.");
