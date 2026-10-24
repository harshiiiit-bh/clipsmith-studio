import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "studio-2.css"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const mobilePrepare = readFileSync(join(root, "scripts", "prepare-mobile.mjs"), "utf8");
const androidWorkflow = readFileSync(join(root, ".github", "workflows", "android-apk.yml"), "utf8");
const workspaceControls = readFileSync(join(root, "workspace-controls.js"), "utf8");
const app = readFileSync(join(root, "app.js"), "utf8");
const subtitleTools = readFileSync(join(root, "subtitle-tools.js"), "utf8");
const powerTools = readFileSync(join(root, "power-tools.js"), "utf8");
const runtimeGuard = readFileSync(join(root, "runtime-guard.js"), "utf8");

assert.match(html, /href="\.\/styles\.css\?[^"]+"/, "legacy editor stylesheet remains linked");
assert.match(html, /href="\.\/studio-2\.css\?v=20261024-ratiowork2"/, "Studio stylesheet cache key is refreshed for this release");
assert.ok(
  html.indexOf('href="./studio-2.css?') > html.indexOf('href="./styles.css?'),
  "Studio 2.0 overrides must load after the legacy editor CSS"
);

for (const selector of [
  ".app-shell", ".topbar", ".workspace", ".tool-rail", ".editor-center",
  ".preview-stage", ".timeline-panel", ".inspector", ".mobile-nav", ".mobile-tab"
]) {
  assert.ok(css.includes(selector), `responsive layer covers ${selector}`);
}

for (const breakpoint of [
  "min-width: 1440px", "max-width: 1280px", "max-width: 1100px",
  "max-width: 820px", "max-width: 520px", "max-width: 420px"
]) {
  assert.ok(css.includes(breakpoint), `missing responsive breakpoint: ${breakpoint}`);
}

assert.match(css, /prefers-reduced-motion:\s*reduce/, "respects reduced-motion preferences");
assert.match(css, /:focus-visible/, "keyboard focus remains visible");
assert.match(css, /env\(safe-area-inset-bottom\)/, "mobile navigation respects device safe areas");
assert.equal(
  packageJson.dependencies?.["react"] ?? packageJson.devDependencies?.["react"],
  undefined,
  "UI refresh must not introduce a heavy framework dependency"
);

assert.match(mobilePrepare, /["']studio-2\.css["']/, "Android WebView packaging must copy the Studio 2.0 stylesheet");
assert.equal(
  (androidWorkflow.match(/- "studio-2\.css"/g) || []).length,
  2,
  "Android workflow must rebuild when Studio 2.0 CSS changes on push or pull request"
);


assert.ok(html.includes('id="focusPreviewBtn"'), "desktop preview focus control exists");
assert.ok(html.includes('id="timelineZoomRange"'), "timeline zoom control exists");
assert.ok(html.includes('id="timelineZoomFitBtn"'), "timeline reset-to-fit control exists");
assert.ok(html.includes('src="./workspace-controls.js?v=20261024-power3"'), "workspace controls cache key is refreshed for this release");
assert.ok(html.includes('src="./app.js?v=20261024-ratiowork2"'), "editor application cache key is refreshed for this release");
assert.ok(app.includes('from "./subtitle-tools.js?v=20261024-power3"'), "changed subtitle module cache key is refreshed");
assert.ok(css.includes(".app-shell.focus-preview .workspace"), "focus mode expands the editing workspace");
assert.ok(css.includes(".timeline-zoom-controls"), "timeline zoom controls receive responsive styling");
assert.ok(css.includes("overflow-x: auto"), "timeline supports horizontal scrolling when zoomed");
assert.ok(workspaceControls.includes('classList.toggle("focus-preview"'), "focus control toggles focus mode");
assert.ok(workspaceControls.includes("aria-pressed"), "focus control reports its active state");
assert.ok(workspaceControls.includes("MutationObserver"), "timeline zoom remains applied after clip sequence updates");
assert.ok(workspaceControls.includes("dataset.baseWidth"), "timeline zoom scales base widths without compounding");
assert.ok(workspaceControls.includes('event.key.toLowerCase() === "f"'), "F toggles preview focus mode");
assert.ok(workspaceControls.includes('event.key === "Escape"'), "Escape exits preview focus mode");
assert.ok(html.includes("<kbd>F</kbd>"), "keyboard help documents the focus shortcut");
assert.ok(mobilePrepare.includes('"workspace-controls.js"'), "Android WebView packaging must copy workspace controls");
assert.equal(
  (androidWorkflow.split('- "workspace-controls.js"').length - 1),
  2,
  "Android workflow must rebuild when workspace controls change on push or pull request"
);

assert.ok(html.includes('id="commandPaletteBtn"'), "quick actions trigger exists");
assert.ok(html.includes('id="commandPaletteSearch"'), "quick actions search field exists");
assert.ok(html.includes('id="commandPaletteList"'), "quick actions list exists");
assert.ok(html.includes('id="titleBold"') && html.includes('id="titleItalic"'), "bold and italic controls exist");
assert.ok(html.includes('id="titleSpacing"') && html.includes('id="titleShadow"'), "letter spacing and shadow controls exist");
for (const font of ["Manrope", "Poppins", "Montserrat", "Roboto Condensed", "Permanent Marker", "Playfair Display"]) assert.ok(html.includes(`<option>${font}</option>`), `heading font available: ${font}`);
assert.ok(app.includes("fontWeight:style.bold===false?500:800"), "on-canvas heading reflects bold state");
assert.ok(app.includes('fontStyle:style.italic?"italic":"normal"'), "on-canvas heading reflects italic state");
assert.ok(app.includes("letterSpacing:"), "on-canvas heading reflects letter spacing");
assert.equal(app.split("}\\nfunction ").length - 1, 0, "app.js must not contain escaped \\n separators between function declarations");
assert.ok(app.includes('"titleBold","titleItalic","titleSpacing","titleShadow"'), "new typography controls persist through the existing style handler");
assert.ok(subtitleTools.includes("${titleBold},${titleItalic}"), "MP4/ASS title style exports bold and italic settings");
assert.ok(subtitleTools.includes("${titleSpacing}"), "MP4/ASS title style exports letter spacing");
assert.ok(subtitleTools.includes("${(titleShadow/3).toFixed(1)}"), "MP4/ASS title style exports shadow depth");
assert.ok(workspaceControls.includes("const actions = ["), "quick actions palette has command definitions");
assert.ok(workspaceControls.includes('event.key === "ArrowDown"'), "quick actions supports keyboard navigation");
assert.ok(css.includes(".command-palette-scrim") && css.includes(".text-style-toggles"), "new typography and command palette styles exist");

assert.ok(html.includes('src="./runtime-guard.js?v=20261024-power3"'), "startup guard loads before editor module");
assert.ok(html.indexOf('src="./runtime-guard.js?v=20261024-power3"') < html.indexOf('src="./app.js?v=20261024-ratiowork2"'), "startup diagnostics must load before editor modules");
assert.ok(html.includes('src="./power-tools.js?v=20261024-power3"'), "Power Tools module is loaded");
assert.ok(mobilePrepare.includes('"runtime-guard.js"') && mobilePrepare.includes('"power-tools.js"'), "Android WebView packages both new runtime modules");
assert.ok(runtimeGuard.includes("clipsmith:app-ready") && runtimeGuard.includes("clipsmithStartupRecovery"), "startup failures receive a visible recovery route");
assert.ok(app.includes("20261024-power3") && !/20261024-(?:runtime1|cs3|ai1|ai2|mem1|apk2)/.test(app), "application imports use one release cache key");
assert.ok(powerTools.includes("parseTimecode") && powerTools.includes("powerPreviousFrameBtn"), "precision timecode and frame-step tools are wired");
assert.ok(powerTools.includes("markerWrite") && powerTools.includes("powerLoopBtn"), "local markers and clip loop controls are implemented");
assert.ok(powerTools.includes("exportSelected") && powerTools.includes("powerExportPrefix"), "single-clip export and naming prefix are wired");
assert.ok(css.includes("grid-template-columns:repeat(7,minmax(0,1fr))"), "mobile navigation is sized for the new tool tab");
assert.equal((androidWorkflow.match(/- "power-tools\.js"/g) || []).length, 2, "Android builds when the Power Tools script changes");
assert.equal((androidWorkflow.match(/- "runtime-guard\.js"/g) || []).length, 2, "Android builds when the startup guard changes");

assert.match(css, /--studio-max-vibe/, "Studio Max visual tokens are defined");
assert.match(css, /\.tool\.active::before/, "active desktop tool has a clear spatial indicator");
assert.match(css, /\.mobile-tab\.active::before/, "active mobile tool has a clear spatial indicator");
assert.match(css, /@media \(max-width: 1180px\)/, "dedicated laptop layout breakpoint exists");
assert.match(css, /@media \(max-width: 680px\)/, "large-phone responsive tuning exists");
assert.match(css, /\.panel:focus-within/, "panels surface focus context without losing editor structure");
assert.match(css, /--studio-max-shadow/, "Studio Max elevation token is defined");

assert.match(html, /class="tool-icon" aria-hidden="true"><svg/, "desktop tool navigation uses crisp inline SVG icons");
assert.match(html, /class="mobile-icon" aria-hidden="true"><svg/, "mobile navigation uses crisp inline SVG icons");
assert.match(css, /\.tool-icon svg/, "desktop tool icons have consistent sizing and stroke styling");
assert.match(css, /\.mobile-tab span svg/, "mobile tool icons have consistent sizing and stroke styling");

assert.match(css, /@media \(max-width: 960px\) and \(min-width: 821px\)[\s\S]*?\.top-actions #loadProjectBtn \{ display: inline-flex/, "laptop layout keeps Open project available");

console.log("ClipSmith Studio Max responsive smoke checks passed.");
