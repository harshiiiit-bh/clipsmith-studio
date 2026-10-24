import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const required = [
  'app-shell', 'tool-rail', 'preview-stage', 'inspector', 'timeline',
  'clip-strip', 'export-queue', 'exportRecoveryActions', 'creatorStudio',
  'mobile-nav', 'undoBtn', 'redoBtn', 'splitAtPlayheadBtn', 'duplicateClipBtn',
  'saveProjectBtn', 'loadProjectBtn', 'projectFileInput'
];
for (const id of required) assert.match(html, new RegExp(`id="${id}"`), `${id} must exist in the new editor shell`);

assert.match(html, /class="tool-rail"/, 'desktop tool rail should be present');
assert.match(html, /class="timeline"/, 'compact timeline should be present');
assert.match(html, /class="clip-strip"/, 'clips should be presented as a compact strip');
assert.match(html, /class="export-queue"/, 'exports should have a dedicated queue surface');
assert.match(html, /class="creator-studio"/, 'creator intelligence should have a dedicated surface');
assert.match(html, /ffmpeg@0\.12\.15/, 'FFmpeg WASM should be loaded from a pinned version');
assert.match(html, /@ffmpeg\/core@0\.12\.10/, 'FFmpeg core should be pinned');
assert.match(html, /@tensorflow\/tfjs/, 'optional open-source browser ML support should be available');
assert.match(html, /const MAX_CONCURRENT_EXPORTS\s*=\s*1/, 'exports must be serialized for mobile memory safety');
assert.match(html, /URL\.revokeObjectURL/, 'downloaded object URLs must be released');
assert.match(html, /navigator\.deviceMemory/, 'export capability should consider device memory');
assert.match(html, /stream-copy|stream copy/i, 'export UI should expose stream-copy mode');
assert.match(html, /lower-resolution|low resolution/i, 'export recovery should expose a lower-resolution fallback');
assert.match(html, /caption ideas/i, 'creator assistant should expose caption ideas');
assert.match(html, /hashtags/i, 'creator assistant should expose hashtags');
assert.match(html, /Hinglish/, 'creator assistant should support Hinglish');

console.log('Editor upgrade RED checks executed.');
