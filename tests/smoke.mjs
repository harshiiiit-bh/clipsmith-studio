import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateCreatorIdeas } from "../creator-assistant.js";
import { splitClipAt, duplicateClip, moveClip, createProjectManifest, validateProjectManifest } from "../editor-tools.js";

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
assert.match(html, /ideasTranscript/, "manual transcript context is available to the creator assistant");
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
assert.ok(creatorIdeas.captions[0].toLowerCase().includes("funny scene"), "first hook should reflect supplied transcript text");
assert.ok(creatorIdeas.hashtags.includes("#InstagramReels"), "hashtags should adapt to platform");
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


const editFixtures = [
  { id: "clip-a", start: 0, end: 10, title: "Series · Part 1", caption: "hello", titleStyle: { color: "#fff" } },
  { id: "clip-b", start: 10, end: 20, title: "Series · Part 2", caption: "", titleStyle: { color: "#aaa" } }
];
const split = splitClipAt(editFixtures, "clip-a", 4, { makeId: () => "clip-a-right", titleFor: i => "Series · Part " + (i + 1) });
assert.equal(split.clips.length, 3, "splitting adds exactly one clip");
assert.equal(split.clips[0].end, 4, "left split ends at the playhead");
assert.equal(split.clips[1].start, 4, "right split starts at the playhead");
assert.equal(split.selectedId, "clip-a-right", "newly created split is selected");
assert.equal(splitClipAt(editFixtures, "clip-a", 0, { makeId: () => "bad" }), null, "split boundary is rejected");
assert.equal(splitClipAt(editFixtures, "clip-a", 9.8, { makeId: () => "bad" }), null, "too-short split fragments are rejected");

const duplicated = duplicateClip(editFixtures, "clip-a", { makeId: () => "clip-copy", titleFor: i => "Series · Part " + (i + 1) });
assert.equal(duplicated.clips.length, 3, "duplicate inserts one clip");
assert.equal(duplicated.clips[1].start, 0, "duplicate keeps source in-point");
assert.equal(duplicated.clips[1].end, 10, "duplicate keeps source out-point");
assert.notEqual(duplicated.clips[1].id, duplicated.clips[0].id, "duplicate receives a distinct ID");
duplicated.clips[1].titleStyle.color = "#000";
assert.equal(duplicated.clips[0].titleStyle.color, "#fff", "duplicate styles are deep-cloned");

const moved = moveClip(editFixtures, "clip-b", -1);
assert.deepEqual(moved.clips.map(c => c.id), ["clip-b", "clip-a"], "move earlier reorders the sequence");
assert.equal(moveClip(editFixtures, "clip-a", -1), null, "moving beyond the first position is a no-op");

const manifest = createProjectManifest({
  projectName: "Series",
  sourceFileName: "source.mp4",
  sourceFileSize: 1234,
  sourceDuration: 20,
  clips: editFixtures,
  controls: { aspectSelect: "9:16" }
}, "2026-10-24T00:00:00.000Z");
assert.equal(manifest.format, "clipsmith-project", "project file uses a distinctive format marker");
assert.equal(manifest.version, 1, "project file is versioned");
assert.equal(manifest.source.fileName, "source.mp4", "project metadata remembers source identity");
assert.equal(validateProjectManifest(manifest).clips.length, 2, "valid project manifest can be restored");
assert.equal(validateProjectManifest({ ...manifest, version: 999 }), null, "unknown project versions are rejected");
assert.equal(validateProjectManifest({ ...manifest, clips: [{ id: "oops", start: -1, end: 2 }] }), null, "invalid clip time ranges are rejected");
assert.equal(validateProjectManifest({ ...manifest, clips: "not an array" }), null, "malformed clip collections are rejected");

assert.match(html, /id="undoBtn"/, "undo action is visible in the top bar");
assert.match(html, /id="redoBtn"/, "redo action is visible in the top bar");
assert.match(html, /id="splitAtPlayheadBtn"/, "timeline supports splitting at the playhead");
assert.match(html, /id="duplicateClipBtn"/, "timeline supports duplicating a selected clip");
assert.match(html, /id="moveClipEarlierBtn"/, "timeline supports sequence reordering");
assert.match(html, /id="saveProjectBtn"/, "portable project save is available");
assert.match(html, /id="loadProjectBtn"/, "portable project load is available");
assert.match(html, /id="projectFileInput"/, "project JSON file can be imported");
assert.match(html, /id="exportRecoveryActions"/, "export failure provides a dedicated recovery panel");
assert.match(html, /recoveryOriginalBtn/, "export recovery can switch to original stream");
assert.match(html, /recoverySingleClipBtn/, "export recovery can try a single clip");

console.log("ClipSmith smoke checks passed.");
