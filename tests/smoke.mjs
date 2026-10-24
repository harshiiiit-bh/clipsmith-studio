import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCreatorIdeas } from "../creator-assistant.js";
import { splitClipAt, duplicateClip, moveClip, createProjectManifest, validateProjectManifest, renumberAutoTitles } from "../editor-tools.js";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const app = readFileSync(new URL("app.js", root), "utf8");
const css = readFileSync(new URL("styles.css", root), "utf8");

for (const id of ["app-shell","undoBtn","redoBtn","splitAtPlayheadBtn","duplicateClipBtn","saveProjectBtn","loadProjectBtn","projectFileInput","exportRecoveryActions","recoveryOriginalBtn","recoverySingleClipBtn"]) {
  assert.match(html, new RegExp(`id="${id}"`), `${id} should exist`);
}
assert.match(html, /id="clip-strip"/, "compact clip strip should exist");
assert.match(html, /id="timeline"/, "timeline should exist");
assert.match(html, /id="creatorResults"/, "creator result area should exist");
assert.match(html, /ffmpeg@0\.12\.15/, "FFmpeg wrapper must be pinned");
assert.match(html, /@ffmpeg\/core@0\.12\.10/, "FFmpeg core must be pinned");
assert.match(html, /@tensorflow\/tfjs@4\.22\.0/, "optional browser ML dependency must be pinned");
assert.match(css, /height:100dvh/, "editor must fit the viewport");
assert.match(css, /overflow:hidden/, "page should not become an endless document");
assert.match(app, /const MAX_CONCURRENT_EXPORTS=1/, "exports must be serialized");
assert.match(app, /URL\.revokeObjectURL/, "download URLs must be released");
assert.match(app, /navigator\.deviceMemory/, "export strategy should inspect device memory");
assert.match(app, /-c","copy"/, "original stream export must be available");
assert.match(app, /mode==="mobile"/, "mobile-safe export must be available");
assert.match(app, /generateCreatorIdeas\(/, "creator intelligence must be wired");
assert.match(app, /caption ideas/i, "caption ideas must be surfaced");
assert.match(app, /hashtags/i, "hashtags must be surfaced");

const creator = generateCreatorIdeas({title:"Munna Bhai MBBS", transcript:"A funny scene from the movie", platform:"Instagram Reels", tone:"Funny", language:"Hinglish"});
assert.equal(creator.captions.length, 8);
assert.ok(creator.captions[0].toLowerCase().includes("funny scene"));
assert.ok(creator.hashtags.includes("#InstagramReels"));
assert.ok(creator.hashtags.includes("#Bollywood"));

const clips=[{id:"a",start:0,end:10,title:"Series · Part 1",caption:"hello",titleStyle:{color:"#fff"}},{id:"b",start:10,end:20,title:"Series · Part 2",caption:"",titleStyle:{color:"#aaa"}}];
const split=splitClipAt(clips,"a",4,{makeId:()=>"a2",titleFor:i=>`Series · Part ${i+1}`});
assert.equal(split.clips.length,3);assert.equal(split.clips[0].end,4);assert.equal(split.clips[1].start,4);
const dup=duplicateClip(clips,"a",{makeId:()=>"copy",titleFor:i=>`Series · Part ${i+1}`});
assert.equal(dup.clips.length,3);assert.notEqual(dup.clips[0].id,dup.clips[1].id);
assert.deepEqual(moveClip(clips,"b",-1).clips.map(c=>c.id),["b","a"]);
assert.deepEqual(renumberAutoTitles([{autoTitle:true,title:"x"},{autoTitle:false,title:"Custom"},{autoTitle:true,title:"y"}],i=>`Series · Part ${i+1}`).map(c=>c.title),["Series · Part 1","Custom","Series · Part 3"]);
const manifest=createProjectManifest({projectName:"Series",sourceFileName:"movie.mp4",sourceFileSize:100,sourceDuration:20,clips},"2026-10-24T00:00:00Z");
assert.equal(manifest.version,1);assert.equal(validateProjectManifest(manifest).clips.length,2);assert.equal(validateProjectManifest({...manifest,version:999}),null);

for(const file of ["app.js","creator-assistant.js","editor-tools.js"]){const src=readFileSync(new URL(file,root),"utf8");const out=join(tmpdir(),file);await import("node:fs/promises").then(fs=>fs.writeFile(out,src));execFileSync(process.execPath,["--check",out],{stdio:"inherit"});}
console.log("ClipSmith smoke checks passed.");
