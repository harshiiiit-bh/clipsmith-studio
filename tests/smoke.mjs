import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateCreatorIdeas } from "../creator-assistant.js";

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
assert.match(html, /atempo=.*currentFx\.speed/, "audio speed filter reaches the export path");
assert.match(html, /setpts=.*currentFx\.speed/, "video speed filter reaches the export path");
assert.match(html, /family=Archivo\+Black/, "expanded web fonts are configured");

assert.match(html, /const MAX_ZIP_CLIPS = 8/, "ZIP batches are bounded to protect mobile memory");
assert.match(html, /function explainExportError\(/, "export failures receive actionable diagnostics");
assert.match(html, /function downloadAndRelease\(/, "individual exports release clip buffers as they are delivered");
assert.match(html, /ideasPane\.id="creatorIdeasPane"/, "creator ideas inspector is present");
assert.match(html, /generateIdeasBtn/, "caption and hashtag generation control is present");
assert.match(html, /analyzeFramesBtn/, "optional local frame analysis is available");
assert.match(html, /@tensorflow\/tfjs/, "open-source local visual analysis can be loaded on demand");
assert.match(readFileSync(new URL("../creator-assistant.js", import.meta.url), "utf8"), /export function generateCreatorIdeas\(/, "caption suggestions use video context");
assert.match(html, /data-view="ideas"/, "mobile creator ideas view is wired");
assert.match(html, /Export failed — see details below/, "visible export error state is clearer than a generic toast");


const creatorIdeas = generateCreatorIdeas({
  title: "Munna Bhai MBBS",
  fileName: "movie.mkv",
  transcript: "A funny scene from the movie",
  visualTags: ["person"],
  platform: "Instagram Reels",
  tone: "Funny",
  language: "Hinglish"
});
assert.equal(creatorIdeas.captions.length, 8, "assistant should produce a useful set of caption options");
assert.ok(creatorIdeas.captions.every(line => line.length > 12), "caption options should contain real copy");
assert.ok(creatorIdeas.hashtags.includes("#Bollywood"), "movie context should inform hashtag suggestions");
assert.ok(creatorIdeas.hashtags.length >= 6, "assistant should suggest multiple hashtags");
const idAttrs = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const duplicates = [...new Set(idAttrs.filter((id, i) => idAttrs.indexOf(id) !== i))];
assert.deepEqual(duplicates, [], "element IDs must remain unique");

const modules = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
assert.equal(modules.length, 1, "expected one application module");
const temp = join(tmpdir(), "clipsmith-app.mjs");
writeFileSync(temp, modules[0][1], "utf8");
execFileSync(process.execPath, ["--check", temp], { stdio: "inherit" });

console.log("ClipSmith smoke checks passed.");
