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

  await page.addInitScript(() => {
    if (!localStorage.getItem("clipsmith.project.v2")) {
      localStorage.setItem("clipsmith.project.v2", JSON.stringify({
      projectName: "Stale test draft",
      sourceMeta: { fileName: "old-video.mp4", fileSize: 1234, duration: 60 },
      duration: 60,
      durationPreset: 30,
      aspect: "16:9",
      seriesTitle: "Stale series",
      autoParts: true,
      selectedId: "old-clip",
      clips: [{ id: "old-clip", start: 0, end: 30, title: "Stale Part 1", autoTitle: true }],
      subtitleCues: [],
      skipRanges: []
      }));
    }
  });

  const response = await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "editor document should load");
  await page.waitForSelector("#app-shell");
  await page.waitForTimeout(800);
  await page.waitForFunction(() => {
    const actions = document.querySelector("#draftRecoveryActions");
    return actions && !actions.classList.contains("hidden");
  }, null, { timeout: 5000 });
  assert.equal(await page.locator("#mediaName").textContent(), "Previous draft available",
    "a draft without its original source should be offered, not silently loaded");
  assert.equal(await page.locator("#timeline .timeline-block").count(), 0,
    "clips from a disconnected draft must not appear until recovery is chosen");
  assert.equal(await page.locator("#clip-strip .clip-card").count(), 0,
    "the clip strip stays empty until the user restores the old draft");
  await page.locator("#startFreshBtn").click();
  await page.waitForFunction(() => {
    const actions = document.querySelector("#draftRecoveryActions");
    return actions?.classList.contains("hidden") && localStorage.getItem("clipsmith.project.v2") === null;
  }, null, { timeout: 5000 });
  assert.equal(await page.locator("#mediaName").textContent(), "No video loaded",
    "Start fresh returns to a clean editor");
  await page.waitForTimeout(100);


  // The aspect dropdown must resize the actual canvas, not just update its label.
  const ratioChecks = [
    { value: "16:9", ratio: 16 / 9, name: "landscape" },
    { value: "9:16", ratio: 9 / 16, name: "portrait" },
    { value: "1:1", ratio: 1, name: "square" },
    { value: "4:5", ratio: 4 / 5, name: "feed" }
  ];
  let previousCanvasWidth = 0;
  let previousCanvasHeight = 0;
  let previousPanelWidth = 0;
  let previousTitleFontSize = 0;
  for (const target of ratioChecks) {
    await page.locator("#aspectSelect").selectOption(target.value);
    await page.waitForFunction((value) => {
      const canvas = document.querySelector("#preview-canvas");
      if (!canvas || canvas.dataset.aspect !== value) return false;
      const rect = canvas.getBoundingClientRect();
      const expected = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1, "4:5": 4 / 5 }[value];
      return rect.width > 1 && rect.height > 1 && Math.abs(rect.width / rect.height - expected) < 0.025;
    }, target.value, { timeout: 4000 });
    const dimensions = await page.evaluate(() => {
      const canvas = document.querySelector("#preview-canvas").getBoundingClientRect();
      const panel = document.querySelector(".preview-panel").getBoundingClientRect();
      const editor = document.querySelector(".editor-center");
      const timelinePanel = document.querySelector(".timeline-panel").getBoundingClientRect();
      const stageEl = document.querySelector("#preview-stage");
      const stage = stageEl.getBoundingClientRect();
      const style = getComputedStyle(stageEl);
      const borderLeft = parseFloat(style.borderLeftWidth) || 0;
      const borderTop = parseFloat(style.borderTopWidth) || 0;
      const padLeft = parseFloat(style.paddingLeft) || 0;
      const padRight = parseFloat(style.paddingRight) || 0;
      const padTop = parseFloat(style.paddingTop) || 0;
      const padBottom = parseFloat(style.paddingBottom) || 0;
      const contentCenterX = stage.left + borderLeft + padLeft + (stageEl.clientWidth - padLeft - padRight) / 2;
      const contentCenterY = stage.top + borderTop + padTop + (stageEl.clientHeight - padTop - padBottom) / 2;
      return { canvasWidth: canvas.width, canvasHeight: canvas.height, stageWidth: stage.width, stageHeight: stage.height,
        previewPanelWidth: panel.width, timelinePanelHeight: timelinePanel.height, workspaceAspect: editor.dataset.aspect,
        centerDelta: Math.hypot((canvas.left + canvas.right) / 2 - contentCenterX, (canvas.top + canvas.bottom) / 2 - contentCenterY) };
    });
    assert.ok(dimensions.canvasWidth <= dimensions.stageWidth + 1 && dimensions.canvasHeight <= dimensions.stageHeight + 1,
      target.name + " canvas must fit inside the preview stage");
    assert.ok(dimensions.centerDelta < 3, target.name + " canvas must remain centered");
    const overlayLayout = await page.evaluate(() => {
      const canvas = document.querySelector("#preview-canvas");
      const tools = document.querySelector("#canvasTitleTools");
      const badges = document.querySelector(".preview-badges");
      const title = document.querySelector("#titleOverlay");
      const titleText = document.querySelector("#titleOverlayText");
      const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const c = canvas.getBoundingClientRect();
      const t = tools.getBoundingClientRect();
      const b = badges.getBoundingClientRect();
      const h = title.getBoundingClientRect();
      return {
        toolsInsideCanvas: canvas.contains(tools),
        badgesInsideCanvas: canvas.contains(badges),
        toolsOverlapCanvas: intersects(c, t),
        badgesOverlapCanvas: intersects(c, b),
        titleInCanvas: h.left >= c.left - 1 && h.right <= c.right + 1 && h.top >= c.top - 1 && h.bottom <= c.bottom + 1,
        canvasWidth: c.width,
        canvasBounds: { left: c.left, right: c.right, top: c.top, bottom: c.bottom },
        titleBounds: { left: h.left, right: h.right, top: h.top, bottom: h.bottom },
        titleFontSize: parseFloat(getComputedStyle(titleText).fontSize),
        parentFontSize: parseFloat(getComputedStyle(title).fontSize),
        canvasClientWidth: canvas.clientWidth,
        titleInlineFont: titleText.style.fontSize,
        textFits: titleText.scrollWidth <= titleText.clientWidth + 3
      };
    });
    assert.equal(overlayLayout.toolsInsideCanvas, false, "editor toolbar must stay outside the ratio-sized video frame");
    assert.equal(overlayLayout.badgesInsideCanvas, false, "duration/ratio badges must stay outside the ratio-sized video frame");
    assert.equal(overlayLayout.toolsOverlapCanvas, false, target.name + " toolbar must not cover the canvas");
    assert.equal(overlayLayout.badgesOverlapCanvas, false, target.name + " badges must not cover the canvas");
    assert.ok(overlayLayout.titleInCanvas, target.name + " heading overlay must remain within the video frame: " + JSON.stringify({ canvas: overlayLayout.canvasBounds, title: overlayLayout.titleBounds }));
    assert.equal(dimensions.workspaceAspect, target.value, target.name + " must switch the entire editing workspace layout");
    if (target.value === "16:9") {
      previousCanvasWidth = dimensions.canvasWidth;
      previousCanvasHeight = dimensions.canvasHeight;
      previousPanelWidth = dimensions.previewPanelWidth;
      previousTitleFontSize = overlayLayout.titleFontSize;
    }
    if (target.value === "9:16") {
      assert.ok(dimensions.canvasWidth < previousCanvasWidth * 0.8,
        "portrait selection must visibly narrow the preview canvas");
      assert.ok(dimensions.previewPanelWidth < previousPanelWidth * 0.85,
        "portrait mode must bring the preview workspace sides closer");
      assert.ok(dimensions.canvasHeight > previousCanvasHeight + 30,
        "portrait mode must stretch the editing area downward for a taller canvas");
      assert.ok(overlayLayout.titleFontSize < previousTitleFontSize,
        "portrait heading font must shrink compared with landscape");
    }
    if (target.value === "1:1") {
      assert.ok(dimensions.previewPanelWidth < previousPanelWidth,
        "square mode must use its own dedicated editing area width");
    }
    if (target.value === "4:5") {
      assert.ok(dimensions.previewPanelWidth < previousPanelWidth,
        "4:5 mode must use its own dedicated editing area width");
    }
    assert.ok(overlayLayout.textFits, target.name + " heading must wrap instead of overflowing horizontally");

  }
  await page.locator("#aspectSelect").selectOption("16:9");
  await page.waitForFunction(() => document.querySelector("#preview-canvas")?.dataset.aspect === "16:9");

  // Exercise the real clip carousel without importing a large media file.
  await page.evaluate(() => {
    const strip = document.querySelector("#clip-strip");
    for (let i = 0; i < 12; i++) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "clip-card";
      card.dataset.clipId = "carousel-fixture-" + i;
      card.innerHTML = '<div class="clip-thumb"><span>' + String(i + 1).padStart(2, "0") +
        '</span><span class="drag-hint">drag</span></div><div><div class="clip-meta">PART ' +
        (i + 1) + '</div><div class="clip-title">Fixture clip ' + (i + 1) +
        '</div><div class="clip-time">00:00 → 00:30</div></div>';
      strip.appendChild(card);
    }
  });
  await page.waitForFunction(() => {
    const slider = document.querySelector("#clipStripSlider");
    return slider && !slider.disabled;
  }, null, { timeout: 5000 });
  const clipLayout = await page.evaluate(() => {
    const timeline = document.querySelector("#timeline").getBoundingClientRect();
    const section = document.querySelector(".clip-strip-section").getBoundingClientRect();
    const strip = document.querySelector("#clip-strip");
    const stripRect = strip.getBoundingClientRect();
    const cards = [...strip.querySelectorAll(".clip-card")];
    const first = cards[0].getBoundingClientRect();
    const second = cards[1].getBoundingClientRect();
    return {
      sectionGap: section.top - timeline.bottom,
      stripTop: stripRect.top,
      stripBottom: stripRect.bottom,
      firstTop: first.top,
      firstBottom: first.bottom,
      cardGap: second.left - first.right,
      scrollWidth: strip.scrollWidth,
      clientWidth: strip.clientWidth
    };
  });
  assert.ok(clipLayout.sectionGap >= 4, "clip cards must occupy a row below the source timeline, not overlap it");
  assert.ok(clipLayout.firstTop >= clipLayout.stripTop && clipLayout.firstBottom <= clipLayout.stripBottom + 1,
    "each clip card must stay inside the clip-strip viewport");
  assert.ok(clipLayout.cardGap >= 8, "each clip card must have a visible gap from its neighbour");
  assert.ok(clipLayout.scrollWidth > clipLayout.clientWidth, "many clips must create a horizontally scrollable rail");

  await page.locator("#clipStripSlider").evaluate((el) => {
    el.value = "1000";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const strip = document.querySelector("#clip-strip");
    return strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 2;
  }, null, { timeout: 3000 });
  await page.locator("#clipStripSlider").evaluate((el) => {
    el.value = "0";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#clipStripNextBtn").click();
  await page.waitForFunction(() => document.querySelector("#clip-strip").scrollLeft > 0, null, { timeout: 3000 });
  await page.evaluate(() => {
    const strip = document.querySelector("#clip-strip");
    strip.innerHTML = "";
    strip.scrollLeft = 0;
  });
  await page.waitForFunction(() => document.querySelector("#clipStripSlider").disabled, null, { timeout: 3000 });

  assert.equal(pageErrors.length, 0, "no browser runtime exceptions on startup: " + pageErrors.join(" | ") + " | console: " + localConsoleErrors.join(" | "));
  assert.equal(localConsoleErrors.length, 0, "no local JavaScript errors on startup: " + localConsoleErrors.join(" | "));
  assert.equal(localRequestFailures.length, 0, "all local editor assets should load: " + localRequestFailures.join(" | "));
  assert.equal(await page.locator("#pane-media").isVisible(), true, "Media pane should be visible on first load");
  assert.equal(await page.locator("#uploadBtn").isVisible(), true, "video import action should be available");

  // Confirm the existing editor's tool wiring survives the new UI layer.
  await page.locator('.tool[data-tool="text"]').click();
  assert.equal(await page.locator("#pane-text").isVisible(), true, "Text tool click should open its inspector pane");
  await page.locator("#titleBold").uncheck();
  const weight = await page.locator("#titleOverlayText").evaluate((element) => getComputedStyle(element).fontWeight);
  assert.equal(weight, "500", "typography controls should change the visible title text");
  await page.locator("#titleFont").selectOption("Bangers");
  await page.locator(".advanced-style-details summary").click();
  await page.locator("#titleWeight").selectOption("700");
  await page.locator("#titleColor").evaluate((element) => {
    element.value = "#ff3344";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await page.locator("#canvasTitleColor").inputValue(), "#ff3344", "inspector colour updates the canvas toolbar picker");
  await page.locator("#titleSpacing").evaluate((element) => {
    element.value = "2.5";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const checkTypography = async (ratio) => {
    await page.locator("#aspectSelect").selectOption(ratio);
    await page.waitForFunction(() => {
      const element = document.querySelector("#titleOverlayText");
      const canvas = document.querySelector("#preview-canvas");
      if (!element || !canvas) return false;
      const width = canvas.clientWidth;
      const expected = 2.5 * Math.max(.28, width / 420);
      return Math.abs(parseFloat(getComputedStyle(element).letterSpacing) - expected) < .1;
    });
    const result = await page.locator("#titleOverlayText").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        color: style.color,
        letterSpacing: style.letterSpacing,
        fontSize: style.fontSize,
        canvasWidth: document.querySelector("#preview-canvas").clientWidth,
        fits: element.scrollWidth <= element.clientWidth + 3
      };
    });
    assert.match(result.fontFamily, /Bangers/, ratio + " preserves the selected font");
    assert.equal(result.fontWeight, "700", ratio + " preserves the selected font weight");
    assert.equal(result.color, "rgb(255, 51, 68)", ratio + " preserves the selected colour");
    const expectedSpacing = 2.5 * Math.max(.28, result.canvasWidth / 420);
    assert.ok(Math.abs(parseFloat(result.letterSpacing) - expectedSpacing) < .1, ratio + " scales letter spacing with the preview canvas");
    assert.ok(parseFloat(result.fontSize) > 0, ratio + " keeps visible text sizing");
    assert.ok(result.fits, ratio + " wraps the styled title inside the canvas");
  };
  for (const ratio of ["16:9", "9:16", "1:1", "4:5"]) await checkTypography(ratio);
  await page.locator("#aspectSelect").selectOption("16:9");
  await page.locator("#canvasTitleColor").evaluate((element) => {
    element.value = "#22aa44";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await page.locator("#titleColor").inputValue(), "#22aa44", "canvas toolbar colour updates the inspector picker");
  assert.equal(await page.locator("#titleOverlayText").evaluate((element) => getComputedStyle(element).color), "rgb(34, 170, 68)", "the two colour pickers share the visible title colour");

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
  await page.locator("#aspectSelect").selectOption("9:16");
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#preview-canvas");
    return canvas?.dataset.aspect === "9:16" &&
      Math.abs(canvas.getBoundingClientRect().width / canvas.getBoundingClientRect().height - 9 / 16) < 0.03;
  }, null, { timeout: 4000 });
  const mobileCanvasLayout = await page.evaluate(() => {
    const canvas = document.querySelector("#preview-canvas"), stage = document.querySelector("#preview-stage");
    const tools = document.querySelector("#canvasTitleTools"), badges = document.querySelector(".preview-badges");
    const c = canvas.getBoundingClientRect(), t = tools.getBoundingClientRect(), b = badges.getBoundingClientRect();
    const intersects = (a, z) => a.left < z.right && a.right > z.left && a.top < z.bottom && a.bottom > z.top;
    const text = document.querySelector("#titleOverlayText");
    return { toolsOverlap: intersects(c, t), badgesOverlap: intersects(c, b),
      ratio: c.width / c.height, textFits: text.scrollWidth <= text.clientWidth + 3,
      workspaceAspect: document.querySelector(".editor-center").dataset.aspect,
      timelineAspect: document.querySelector(".timeline-panel").dataset.aspect,
      canvasHeight: c.height };
  });
  assert.equal(mobileCanvasLayout.toolsOverlap, false, "mobile editing toolbar must not cover the portrait canvas");
  assert.equal(mobileCanvasLayout.badgesOverlap, false, "mobile status badges must not cover the portrait canvas");
  assert.ok(Math.abs(mobileCanvasLayout.ratio - 9 / 16) < 0.03, "mobile portrait canvas must keep the selected ratio");
  assert.ok(mobileCanvasLayout.textFits, "mobile portrait heading must wrap inside the canvas");
  assert.equal(mobileCanvasLayout.workspaceAspect, "9:16", "mobile portrait must use its dedicated workspace layout");
  assert.equal(mobileCanvasLayout.timelineAspect, "9:16", "mobile timeline controls must adapt to portrait mode");
  await page.locator("#aspectSelect").selectOption("16:9");
  await page.locator('.mobile-tab[data-tool="text"]').click();
  assert.equal(await page.locator("#pane-text").isVisible(), true, "mobile tab should open its tool pane");
  assert.equal(await page.locator("#inspector").evaluate((el) => el.classList.contains("open")), true,
    "mobile inspector drawer should open with the selected tool");

  await page.locator("#powerToolsMobileBtn").click();
  assert.equal(await page.locator("#powerToolsModal").isVisible(), true, "Power Tools opens from the mobile navigation");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#powerToolsModal").isVisible(), false, "Escape closes Power Tools on mobile");

  // Regression: manual caption text and style controls must update the actual preview live.
  await page.setViewportSize({ width: 1440, height: 960 });
  const captionRegressionDraft = {
    projectName: "Caption Styling Regression", duration: 12, durationPreset: 30, aspect: "16:9",
    seriesTitle: "Caption test", autoParts: false, selectedId: "caption-regression",
    sourceMeta: { fileName: "caption-fixture.mp4", fileSize: 4096, duration: 12 },
    titleStyle: { font: "Inter", size: 30, color: "#ffffff", outline: "#000000", opacity: 1, bold: true, italic: false, spacing: 0, shadow: 6, weight: 800, transform: "none", align: "center", decoration: "none", outlineWidth: 2, shadowColor: "#000000", glow: 0, glowColor: "#8b5cf6", bgEnabled: false, bgColor: "#111827", bgOpacity: .72, bgPadding: 10, bgRadius: 10, rotation: 0, lineHeight: 1.08, positionY: 17 },
    captionStyle: { style: "Classic", text: "", highlight: "#9e83ff", positionY: 78 },
    subtitleSettings: { style: "Classic", highlight: "#9e83ff", positionY: 82 }, exportAspect: "source", burnOverlays: true,
    clips: [{ id: "caption-regression", start: 0, end: 12, title: "Regression heading", autoTitle: false, caption: "Initial live caption", titleStyle: { font: "Inter", size: 30, color: "#ffffff", outline: "#000000", opacity: 1, bold: true, italic: false, spacing: 0, shadow: 6, weight: 800, transform: "none", align: "center", decoration: "none", outlineWidth: 2, shadowColor: "#000000", glow: 0, glowColor: "#8b5cf6", bgEnabled: false, bgColor: "#111827", bgOpacity: .72, bgPadding: 10, bgRadius: 10, rotation: 0, lineHeight: 1.08, positionY: 17 }, captionStyle: { style: "Classic", highlight: "#9e83ff", positionY: 78 }, fx: { preset: "Original", brightness: 0, contrast: 1, saturation: 1, blur: 0, speed: 1, volume: 1, mute: false, normalize: false } }],
    skipRanges: [], subtitleCues: [], exportSettings: {}
  };

  await page.addInitScript((draft) => localStorage.setItem("clipsmith.project.v2", JSON.stringify(draft)), captionRegressionDraft);
  await page.goto(origin + "/?caption-style-regression=1", { waitUntil: "domcontentloaded" });

  await page.waitForFunction(() => {
    const actions = document.querySelector("#draftRecoveryActions");
    return actions && !actions.classList.contains("hidden");
  }, null, { timeout: 5000 });
  await page.locator("#restoreDraftBtn").click();
  await page.waitForFunction(() => document.querySelector("#captionOverlay")?.textContent === "Initial live caption", null, { timeout: 3000 });
  await page.locator('.tool[data-tool="captions"]').click();
  await page.locator("#captionStyle").selectOption("Pop");
  await page.waitForFunction(() => {
    const element = document.querySelector("#captionOverlay");
    const background = getComputedStyle(element).backgroundColor;
    return element?.dataset.style === "Pop" && background !== "rgba(0, 0, 0, 0)";
  }, null, { timeout: 3000 });
  const popStyle = await page.locator("#captionOverlay").evaluate(element => ({
    style: element.dataset.style, background: getComputedStyle(element).backgroundColor,
    transform: getComputedStyle(element).transform
  }));
  assert.equal(popStyle.style, "Pop", "caption preset changes on selection without pressing Apply");
  assert.notEqual(popStyle.background, "rgba(0, 0, 0, 0)", "Pop caption receives its visible background immediately");
  assert.notEqual(popStyle.transform, "none", "Pop caption recentres itself immediately");
  await page.locator("#captionHighlightColor").evaluate(element => {
    element.value = "#00ff88"; element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await page.locator("#captionOverlay").evaluate(element => getComputedStyle(element).color), "rgb(0, 255, 136)",
    "caption highlight picker updates visible text immediately");
  await page.locator("#captionPositionY").evaluate(element => {
    element.value = "90"; element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await page.locator("#captionOverlay").evaluate(element => element.style.bottom), "10%",
    "caption position slider updates the preview immediately");
  await page.locator("#captionText").fill("Updated live caption");
  await page.waitForFunction(() => document.querySelector("#captionOverlay")?.textContent === "Updated live caption", null, { timeout: 3000 });

  // Advanced export preferences must autosave and rehydrate with the project.
  await page.locator("#export-queue").evaluate(element => element.classList.remove("hidden"));
  await page.locator("#exportResolution").selectOption("1080");
  await page.locator("#exportFrameRate").selectOption("30");
  await page.locator("#exportCrf").evaluate(element => {
    element.value = "18"; element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#exportWatermark").check();
  await page.locator("#exportWatermarkText").fill("My Channel");
  const savedExportSettings = await page.evaluate(() => JSON.parse(localStorage.getItem("clipsmith.project.v2")).exportSettings);
  assert.equal(savedExportSettings.resolution, "1080", "output resolution is autosaved");
  assert.equal(savedExportSettings.frameRate, "30", "output frame rate is autosaved");
  assert.equal(savedExportSettings.crf, 18, "output quality is autosaved as a number");
  assert.equal(savedExportSettings.watermark, true, "watermark setting is autosaved");
  assert.equal(savedExportSettings.watermarkText, "My Channel", "watermark text is autosaved");
  assert.equal(await page.locator("#exportPreviewStage").isVisible(), true, "export center contains the final-output preview stage");
  await page.locator("#exportPreviewClipSelect").selectOption("caption-regression");
  await page.locator("#exportIncludeTitle").uncheck();
  assert.equal(await page.locator("#exportPreviewTitle").isVisible(), false, "disabling Burn heading hides it in the final-output preview");
  await page.locator("#exportIncludeTitle").check();
  assert.equal(await page.locator("#exportPreviewTitle").textContent(), "Regression heading", "final-output preview uses the chosen clip heading");
  await page.locator("#exportWatermark").check();
  assert.equal(await page.locator("#exportPreviewWatermark").textContent(), "My Channel", "watermark settings update the preview");
  await page.locator("#clearExportClipSelectionBtn").click();
  assert.equal(await page.locator("#exportSelectionCount").textContent(), "0 of 1 selected", "Clear selection works");
  await page.locator("#selectAllExportClipsBtn").click();
  assert.equal(await page.locator("#exportSelectionCount").textContent(), "1 of 1 selected", "Select all works");

  assert.equal(pageErrors.length, 0, "no runtime exceptions during interactions: " + pageErrors.join(" | "));
  assert.equal(localRequestFailures.length, 0, "no local assets fail during interaction: " + localRequestFailures.join(" | "));
  console.log("ClipSmith browser runtime smoke checks passed: startup, assets, text styling, focus mode, Quick Actions, Power Tools presets, export filename preview, and mobile navigation.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
