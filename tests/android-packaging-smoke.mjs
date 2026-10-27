import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root=new URL("../",import.meta.url);
for(const file of ["mobile-memory.js","memory-vault.js","scripts/prepare-mobile.mjs","scripts/patch-android.mjs"]){
 const source=readFileSync(new URL(file,root),"utf8");
 const out=join(tmpdir(),file.replaceAll("/","-"));
 await import("node:fs/promises").then(fs=>fs.writeFile(out,source));
 execFileSync(process.execPath,["--check",out],{stdio:"inherit"});
}
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const prepSource=readFileSync(new URL("../scripts/prepare-mobile.mjs",import.meta.url),"utf8");
const manifestMatch=prepSource.match(/const files=\[([\s\S]*?)\];/);
assert.ok(manifestMatch,"Android bundle manifest should be discoverable");
const bundledFiles=new Set([...manifestMatch[1].matchAll(/"([^"]+)"/g)].map(match=>match[1]));
const appSource=readFileSync(new URL("../app.js",import.meta.url),"utf8");
const linkedAssets=[...html.matchAll(/(?:src|href)=["']\.\/([^"'?#]+)(?:\?[^"']*)?["']/g)].map(match=>match[1]);
const importedAssets=[...appSource.matchAll(/(?:from|import\()\s*["']\.\/([^"'?#]+)(?:\?[^"']*)?["']/g)].map(match=>match[1]);
for(const asset of new Set([...linkedAssets,...importedAssets])){
 assert.ok(bundledFiles.has(asset),`Android bundle must include local asset referenced by the page or editor modules: ${asset}`);
}
assert.match(html,/apkDownloadBtn/);
assert.match(html,/releases\/download\/android-latest\/ClipSmith\.apk/);
assert.match(html,/memorySafeModeToggle/);assert.match(html,/memoryVaultStatus/);assert.match(html,/memorySaveNowBtn/);assert.match(html,/memoryClearBtn/);
console.log("Android packaging configuration checks passed.");
