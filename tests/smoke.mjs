import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCreatorIdeas } from "../creator-assistant.js";
import { splitClipAt, duplicateClip, moveClip, createProjectManifest, validateProjectManifest, renumberAutoTitles } from "../editor-tools.js";

const root = new URL("../", import.meta.url); const html = readFileSync(new URL("index.html", root), "utf8"); const app = readFileSync(new URL("app.js", root), "utf8"); const css = readFileSync(new URL("styles.css", root), "utf8");
for (const id of ["app-shell","undoBtn","redoBtn","splitAtPlayheadBtn","duplicateClipBtn","saveProjectBtn","loadProjectBtn","projectFileInput","exportRecoveryActions","recoveryOriginalBtn","recoverySingleClipBtn"]) assert.match(html,new RegExp(`id="${id}"`),`${id} should exist`);
assert.match(html,/id="clip-strip"/); assert.match(html,/id="timeline"/); assert.match(html,/id="creatorResults"/); assert.doesNotMatch(html,/@tensorflow\/tfjs/, "vision code should stay off the initial page load");
assert.match(app,/ffmpeg@0\.12\.15/); assert.match(app,/@ffmpeg\/core@0\.12\.10/); assert.match(css,/height:100dvh/); assert.match(css,/overflow:hidden/); assert.match(app,/const MAX_CONCURRENT_EXPORTS=1/); assert.match(app,/URL\.revokeObjectURL/); assert.match(app,/navigator\.deviceMemory/); assert.match(app,/-c","copy"/); assert.match(app,/mode==="mobile"/); assert.match(app,/generateCreatorIdeas\(/); assert.match(app,/tf\.min\.js/); assert.match(app,/function analyzeCurrentFrame\(/); assert.match(html,/caption ideas/i); assert.match(html,/hashtags/i);
const creator=generateCreatorIdeas({title:"Munna Bhai MBBS",transcript:"A funny scene from the movie",platform:"Instagram Reels",tone:"Funny",language:"Hinglish"}); assert.equal(creator.captions.length,8); assert.ok(creator.captions[0].toLowerCase().includes("funny scene")); assert.ok(creator.hashtags.includes("#InstagramReels")); assert.ok(creator.hashtags.includes("#Bollywood"));
const clips=[{id:"a",start:0,end:10,title:"Series · Part 1",caption:"hello",titleStyle:{color:"#fff"}},{id:"b",start:10,end:20,title:"Series · Part 2",caption:"",titleStyle:{color:"#aaa"}}]; const split=splitClipAt(clips,"a",4,{makeId:()=>"a2",titleFor:i=>`Series · Part ${i+1}`}); assert.equal(split.clips.length,3); assert.equal(split.clips[0].end,4); assert.equal(split.clips[1].start,4); const dup=duplicateClip(clips,"a",{makeId:()=>"copy",titleFor:i=>`Series · Part ${i+1}`}); assert.equal(dup.clips.length,3); assert.notEqual(dup.clips[0].id,dup.clips[1].id); assert.deepEqual(moveClip(clips,"b",-1).clips.map(c=>c.id),["b","a"]); assert.deepEqual(renumberAutoTitles([{autoTitle:true,title:"x"},{autoTitle:false,title:"Custom"},{autoTitle:true,title:"y"}],i=>`Series · Part ${i+1}`).map(c=>c.title),["Series · Part 1","Custom","Series · Part 3"]);
const manifest=createProjectManifest({projectName:"Series",sourceFileName:"movie.mp4",sourceFileSize:100,sourceDuration:20,clips},"2026-10-24T00:00:00Z"); assert.equal(manifest.version,1); assert.equal(validateProjectManifest(manifest).clips.length,2); assert.equal(validateProjectManifest({...manifest,version:999}),null);
for(const file of ["app.js","creator-assistant.js","editor-tools.js"]){const src=readFileSync(new URL(file,root),"utf8"); const out=join(tmpdir(),file); await import("node:fs/promises").then(fs=>fs.writeFile(out,src)); execFileSync(process.execPath,["--check",out],{stdio:"inherit"})} 
const editorTools = await import("../editor-tools.js");
assert.equal(typeof editorTools.buildClipSegments, "function", "automatic clip planning should be testable and reusable");
const planned = editorTools.buildClipSegments(126, 30);
assert.deepEqual(planned.map(({start,end,index}) => [start,end,index]), [[0,30,0],[30,60,1],[60,90,2],[90,120,3],[120,126,4]], "clip planning must cover the full source with a shorter final segment");
assert.deepEqual(editorTools.buildClipSegments(0, 30), [], "zero-duration sources must not create phantom clips");
assert.deepEqual(editorTools.buildClipSegments(0.3, 30), [], "sub-half-second leftovers should be skipped safely");
for (const id of ["emptyUploadBtn","videoUrl","loadUrlBtn","importStatus"]) assert.match(html,new RegExp(`id="${id}"`),`${id} should make import discoverable and understandable`);
assert.match(app,/function loadVideoUrl\(/, "direct video links should use a dedicated, validated loader");
assert.match(app,/autoGenerateAfterMetadata/, "a successful import should automatically produce an initial clip plan");
assert.match(app,/lastCommittedSnapshot/, "undo/redo should store the previous state rather than the already-mutated state");
assert.match(app,/mode==="smart".*?stream-copy/s, "Smart export should retry with compatible encoding when stream-copy fails");

console.log("ClipSmith smoke checks passed.");
