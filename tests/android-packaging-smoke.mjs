import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root=new URL("../",import.meta.url);
for(const file of ["mobile-memory.js","scripts/prepare-mobile.mjs","scripts/patch-android.mjs"]){
 const source=readFileSync(new URL(file,root),"utf8");
 const out=join(tmpdir(),file.replaceAll("/","-"));
 await import("node:fs/promises").then(fs=>fs.writeFile(out,source));
 execFileSync(process.execPath,["--check",out],{stdio:"inherit"});
}
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
assert.match(html,/apkDownloadBtn/);
assert.match(html,/releases\/download\/android-latest\/ClipSmith\.apk/);
assert.match(html,/memorySafeModeToggle/);
console.log("Android packaging configuration checks passed.");
