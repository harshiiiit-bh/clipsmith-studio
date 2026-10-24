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

assert.match(html, /href="\.\/styles\.css\?[^"]+"/, "legacy editor stylesheet remains linked");
assert.match(html, /href="\.\/studio-2\.css\?[^"]+"/, "Studio 2.0 responsive layer is linked");
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

console.log("ClipSmith Studio 2.0 responsive smoke checks passed.");
