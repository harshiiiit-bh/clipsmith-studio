import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL("../index.html", import.meta.url));
const html = readFileSync(here, "utf8");

assert.match(html, /height:100dvh/, "workspace should be constrained to the viewport");
assert.match(html, /overflow:hidden/, "page shell should not become an endless document");
assert.match(html, /fxPane\.dataset\.pane="fx"/, "FX inspector pane is registered");
assert.match(html, /data-tool="fx"/, "FX inspector tab is available");
assert.match(html, /id="fxSpeed"/, "speed control is present");
assert.match(html, /id="fxVolume"/, "volume/gain control is present");
assert.match(html, /id="titleStrokeColor"/, "title outline color control is present");
assert.match(html, /id="titleOpacity"/, "title opacity control is present");
assert.match(html, /id="titleRotation"/, "title rotation control is present");
assert.match(html, /id="captionHighlightColor"/, "caption highlight color control is present");
assert.match(html, /id="captionPositionY"/, "caption positioning control is present");
assert.match(html, /id="exportAllIndividualBtn"/, "all-individual export action is present");
assert.match(html, /id="exportZipSelectedBtn"/, "selected ZIP export is an optional separate action");
assert.match(html, /ZIP all clips \(optional\)/, "ZIP is labeled as optional");
assert.match(html, /exportClips\(null,'individual'\)/, "mobile export path is individual files");
assert.match(html, /atempo=.*fx\.speed/, "audio speed filter reaches the export path");
assert.match(html, /setpts=/, "video speed filter reaches the export path");
assert.match(html, /family=Archivo\+Black/, "expanded web fonts are configured");

assert.match(html, /const MAX_ZIP_CLIPS = 8/, "ZIP batches are bounded to protect mobile memory");
assert.match(html, /function explainExportError\(/, "export failures receive actionable diagnostics");
assert.match(html, /function downloadAndRelease\(/, "individual exports release clip buffers as they are delivered");
assert.match(html, /id="creatorIdeasPane"/, "creator ideas inspector is present");
assert.match(html, /id="generateIdeasBtn"/, "caption and hashtag generation control is present");
assert.match(html, /id="analyzeFramesBtn"/, "optional local frame analysis is available");
assert.match(html, /@tensorflow\/tfjs/, "open-source local visual analysis can be loaded on demand");
assert.match(html, /function generateCreatorIdeas\(/, "caption suggestions use video context");
assert.match(html, /setMobileView\('ideas'\)/, "mobile creator ideas view is wired");
assert.match(html, /Export failed — see details below/, "visible export error state is clearer than a generic toast");


const idAttrs = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const duplicates = [...new Set(idAttrs.filter((id, i) => idAttrs.indexOf(id) !== i))];
assert.deepEqual(duplicates, [], "element IDs must remain unique");

const modules = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
assert.equal(modules.length, 1, "expected one application module");
const temp = join(tmpdir(), "clipsmith-app.mjs");
writeFileSync(temp, modules[0][1], "utf8");
execFileSync(process.execPath, ["--check", temp], { stdio: "inherit" });

console.log("ClipSmith smoke checks passed.");
