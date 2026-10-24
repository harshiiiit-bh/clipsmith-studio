import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg"
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
    const relativePath = pathname.replace(/^\/+/, "") || "index.html";
    const filePath = resolve(root, relativePath);
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const data = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(data);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

await new Promise((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(0, "127.0.0.1", resolveListen);
});

const address = server.address();
const origin = "http://127.0.0.1:" + address.port;
let browser;

try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const pageErrors = [];
  const localRequestFailures = [];
  const localConsoleErrors = [];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Runtime.enable");
  cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    const frame = exceptionDetails.stackTrace?.callFrames?.[0];
    pageErrors.push(JSON.stringify({
      text: exceptionDetails.text,
      url: frame?.url || exceptionDetails.url || "",
      line: (frame?.lineNumber ?? exceptionDetails.lineNumber ?? -1) + 1,
      column: (frame?.columnNumber ?? exceptionDetails.columnNumber ?? -1) + 1,
      description: exceptionDetails.exception?.description || ""
    }));
  });
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    if (!location.url || location.url.startsWith(origin + "/")) {
      localConsoleErrors.push((location.url || "(unknown source)") + ":" + (location.lineNumber || 0) + ":" + (location.columnNumber || 0) + " " + message.text());
    }
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(origin + "/")) {
      localRequestFailures.push(request.url() + " — " + (request.failure()?.errorText || "request failed"));
    }
  });

  // The app is intentionally tested without Google Fonts/CDN availability.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) await route.abort();
    else await route.continue();
  });

  const response = await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "editor document should load");
  await page.waitForSelector("#app-shell");
  await page.waitForTimeout(800);

  assert.equal(pageErrors.length, 0, "no browser runtime exceptions on startup: " + pageErrors.join(" | ") + " | console: " + localConsoleErrors.join(" | "));
  assert.equal(localConsoleErrors.length, 0, "no local JavaScript errors on startup: " + localConsoleErrors.join(" | "));
  assert.equal(localRequestFailures.length, 0, "all local editor assets should load: " + localRequestFailures.join(" | "));
  assert.equal(await page.locator("#pane-media").isVisible(), true, "Media pane should be visible on first load");
  assert.equal(await page.locator("#uploadBtn").isVisible(), true, "video import action should be available");

  // Confirm the existing editor's tool wiring survives the new UI layer.
  await page.locator('.tool[data-tool="text"]').click();
  assert.equal(await page.locator("#pane-text").isVisible(), true, "Text tool click should open its inspector pane");
  await page.locator("#titleBold").uncheck();
  const weight = await page.locator("#titleOverlay").evaluate((element) => getComputedStyle(element).fontWeight);
  assert.equal(weight, "500", "typography controls should change the actual preview");

  // Confirm preview focus is interactive, not just a styled button.
  await page.locator("#focusPreviewBtn").click();
  assert.equal(await page.locator("#app-shell").evaluate((el) => el.classList.contains("focus-preview")), true,
    "Focus button should enter focus mode");
  await page.keyboard.press("f");
  assert.equal(await page.locator("#app-shell").evaluate((el) => el.classList.contains("focus-preview")), false,
    "F shortcut should exit focus mode");

  // Confirm Quick Actions opens, filters, runs a real command, and closes.
  await page.keyboard.press("Control+k");
  assert.equal(await page.locator("#commandPaletteModal").isVisible(), true, "Ctrl+K should open Quick Actions");
  await page.locator("#commandPaletteSearch").fill("open text styling");
  assert.equal(await page.locator(".command-item").count(), 1, "search should filter to the Open Text styling command");
  await page.locator(".command-item").click();
  assert.equal(await page.locator("#commandPaletteModal").isVisible(), false, "command palette should close after running an action");
  assert.equal(await page.locator("#pane-text").isVisible(), true, "Quick Actions command should open the selected inspector pane");

  // Creator Power Tools must work as real controls, not a visual-only modal.
  await page.locator("#powerToolsBtn").click();
  assert.equal(await page.locator("#powerToolsModal").isVisible(), true, "Power Tools opens from the desktop toolbar");
  const timecodeChecks = await page.evaluate(() => ({
    full: window.ClipSmithPowerTools.parseTimecode("01:02:03.5"),
    short: window.ClipSmithPowerTools.parseTimecode("01:23"),
    decimal: window.ClipSmithPowerTools.parseTimecode("12.25"),
    invalid: window.ClipSmithPowerTools.parseTimecode("01:60")
  }));
  assert.deepEqual(timecodeChecks, { full: 3723.5, short: 83, decimal: 12.25, invalid: null },
    "timecode parser accepts supported formats and rejects out-of-range seconds");
  await page.locator("#presetShortsBtn").click();
  assert.equal(await page.locator("#aspectSelect").inputValue(), "9:16", "Shorts preset changes the preview ratio");
  assert.equal(await page.locator("#exportAspectSelect").inputValue(), "9:16", "Shorts preset also changes the export ratio");
  await page.locator("#powerExportPrefix").fill("WatchToon");
  assert.equal(await page.locator("#powerFilenamePreview").textContent(), "WatchToon-01-clip-title.mp4", "custom export filename preview updates live");
  await page.locator("#closePowerToolsBtn").click();
  assert.equal(await page.locator("#powerToolsModal").isVisible(), false, "Power Tools closes cleanly");
  await page.keyboard.press("Alt+p");
  assert.equal(await page.locator("#powerToolsModal").isVisible(), true, "Alt+P opens Creator Power Tools");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#powerToolsModal").isVisible(), false, "Escape closes Creator Power Tools");


  // Check the smaller viewport and mobile tab integration too.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.mobile-tab[data-tool="text"]').click();
  assert.equal(await page.locator("#pane-text").isVisible(), true, "mobile tab should open its tool pane");
  assert.equal(await page.locator("#inspector").evaluate((el) => el.classList.contains("open")), true,
    "mobile inspector drawer should open with the selected tool");

  await page.locator("#powerToolsMobileBtn").click();
  assert.equal(await page.locator("#powerToolsModal").isVisible(), true, "Power Tools opens from the mobile navigation");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#powerToolsModal").isVisible(), false, "Escape closes Power Tools on mobile");


  assert.equal(pageErrors.length, 0, "no runtime exceptions during interactions: " + pageErrors.join(" | "));
  assert.equal(localRequestFailures.length, 0, "no local assets fail during interaction: " + localRequestFailures.join(" | "));
  console.log("ClipSmith browser runtime smoke checks passed: startup, assets, text styling, focus mode, Quick Actions, Power Tools presets, export filename preview, and mobile navigation.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
