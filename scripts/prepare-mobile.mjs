import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const out=path.join(root,"mobile-www");
const files=[
  "index.html","styles.css","studio-2.css","studio-polish.css","brand-finish.css","clipsmith-logo.svg","clipsmith-mark.svg","runtime-guard.js","workspace-controls.js","power-tools.js","app.js","media-import.js","creator-assistant.js","editor-tools.js","export-overlay.js",
  "subtitle-tools.js","transcribe-worker.js","ai-creator-tools.js","typography-enhancements.js","mobile-memory.js","memory-vault.js"
];
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const file of files)await cp(path.join(root,file),path.join(out,file));
await cp(path.join(root,"ffmpeg"),path.join(out,"ffmpeg"),{recursive:true});
console.log(`Prepared ${files.length} local editor assets plus the same-origin FFmpeg worker for the Android WebView.`);
