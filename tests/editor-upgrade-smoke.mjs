import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root=new URL('../',import.meta.url);const html=readFileSync(new URL('index.html',root),'utf8');const app=readFileSync(new URL('app.js',root),'utf8');const css=readFileSync(new URL('styles.css',root),'utf8');
for(const id of ['app-shell','preview-stage','inspector','timeline','clip-strip','clipStripSlider','clipStripPrevBtn','clipStripNextBtn','clipStripPosition','export-queue','exportRecoveryActions','mobile-nav','undoBtn','redoBtn','splitAtPlayheadBtn','duplicateClipBtn','saveProjectBtn','loadProjectBtn','projectFileInput'])assert.match(html,new RegExp(`id="${id}"`),`${id} must exist`);
for(const cls of ['tool-rail','timeline','clip-strip','export-queue','creator-studio'])assert.match(html,new RegExp(`class="[^"]*${cls}[^"]*"`),`${cls} surface must exist`);
assert.match(app,/ffmpeg@0\.12\.15/);assert.match(app,/@ffmpeg\/core@0\.12\.10/);assert.match(app,/tf\.min\.js/);assert.match(css,/height:100dvh/);assert.match(css,/overflow:hidden/);assert.match(app,/const MAX_CONCURRENT_EXPORTS\s*=\s*1/);assert.match(app,/URL\.revokeObjectURL/);

assert.match(html,/id="preview-canvas"/,"preview stage must contain a separately sized target-ratio canvas");
assert.match(app,/function applyCanvasAspect\(\)/,"aspect selector needs a canvas layout function");
assert.match(app,/canvas\.style\.width=width\+"px"/,"aspect changes must resize the canvas width");
assert.match(app,/canvas\.style\.height=height\+"px"/,"aspect changes must resize the canvas height");
assert.match(app,/canvasAspectObserver\?\.observe\(\$\("preview-stage"\)\)/,"canvas ratio must respond to workspace resize");
assert.match(css,/\.preview-canvas > #previewVideo/,"video should fit inside the target-ratio canvas");
assert.match(app,/navigator\.deviceMemory/);assert.match(html,/Original stream/i);assert.match(html,/Mobile safe/i);assert.match(html,/caption ideas/i);assert.match(html,/hashtags/i);assert.match(html,/Hinglish/);console.log('Editor upgrade smoke checks passed.');
