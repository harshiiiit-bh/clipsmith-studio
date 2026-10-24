/* Desktop-only workspace controls. The editing engine remains in app.js. */
const shell = document.querySelector(".app-shell");
const focusButton = document.getElementById("focusPreviewBtn");
const desktopViewport = window.matchMedia("(min-width: 821px)");

if (shell && focusButton) {
  const buttonLabel = focusButton.querySelector("b");

  const syncFocusControl = () => {
    const active = desktopViewport.matches && shell.classList.contains("focus-preview");
    focusButton.setAttribute("aria-pressed", String(active));
    focusButton.setAttribute(
      "aria-label",
      active ? "Exit preview focus mode" : "Enter preview focus mode"
    );
    focusButton.title = active
      ? "Return to the full editing workspace"
      : "Expand the preview workspace";
    if (buttonLabel) buttonLabel.textContent = active ? "Exit focus" : "Focus";
  };

  focusButton.addEventListener("click", () => {
    if (!desktopViewport.matches) return;
    shell.classList.toggle("focus-preview");
    syncFocusControl();
  });

  desktopViewport.addEventListener("change", syncFocusControl);

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLElement && (
      target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
    );

    if (event.key === "Escape" && shell.classList.contains("focus-preview")) {
      shell.classList.remove("focus-preview");
      syncFocusControl();
      return;
    }

    if (
      !isTyping &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.key.toLowerCase() === "f" &&
      desktopViewport.matches
    ) {
      event.preventDefault();
      shell.classList.toggle("focus-preview");
      syncFocusControl();
    }
  });

  syncFocusControl();
}


/* Timeline zoom is a workspace preference, not part of the saved edit. */
const timeline = document.getElementById("timeline");
const zoomRange = document.getElementById("timelineZoomRange");
const zoomValue = document.getElementById("timelineZoomValue");
const zoomOut = document.getElementById("timelineZoomOutBtn");
const zoomIn = document.getElementById("timelineZoomInBtn");
const zoomFit = document.getElementById("timelineZoomFitBtn");

if (timeline && zoomRange) {
  const readZoom = () => Math.min(3, Math.max(1, Number(zoomRange.value) || 1));

  const syncTimelineZoom = () => {
    const zoom = readZoom();
    timeline.querySelectorAll(".timeline-block").forEach((block) => {
      if (!block.dataset.baseWidth) {
        const baseWidth = Number.parseFloat(block.style.width);
        if (Number.isFinite(baseWidth)) block.dataset.baseWidth = String(baseWidth);
      }
      const baseWidth = Number(block.dataset.baseWidth);
      if (Number.isFinite(baseWidth)) {
        block.style.width = `${Math.max(62, Math.round(baseWidth * zoom))}px`;
      }
    });

    if (zoomValue) zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    if (zoomOut) zoomOut.disabled = zoom <= 1;
    if (zoomIn) zoomIn.disabled = zoom >= 3;
  };

  const changeZoom = (next) => {
    zoomRange.value = String(Math.min(3, Math.max(1, next)));
    syncTimelineZoom();
  };

  zoomRange.addEventListener("input", syncTimelineZoom);
  zoomOut?.addEventListener("click", () => changeZoom(readZoom() - 0.25));
  zoomIn?.addEventListener("click", () => changeZoom(readZoom() + 0.25));
  zoomFit?.addEventListener("click", () => {
    changeZoom(1);
    timeline.scrollLeft = 0;
  });

  const timelineObserver = new MutationObserver(syncTimelineZoom);
  timelineObserver.observe(timeline, { childList: true });
  syncTimelineZoom();
}


/* Searchable command palette for rapid editing workflows. */
const palette = document.getElementById("commandPaletteModal");
const paletteTrigger = document.getElementById("commandPaletteBtn");
const paletteClose = document.getElementById("closeCommandPaletteBtn");
const paletteSearch = document.getElementById("commandPaletteSearch");
const paletteList = document.getElementById("commandPaletteList");
const paletteHint = document.getElementById("commandPaletteHint");

if (palette && paletteTrigger && paletteSearch && paletteList) {
  let activeCommand = 0;
  const actions = [
    { id: "media", title: "Open Media panel", detail: "Import a video and manage source media", category: "Navigate", keywords: "video upload import file source", run: () => useTool("media") },
    { id: "clips", title: "Open Clips panel", detail: "Trim, reorder, duplicate, and clean up clips", category: "Navigate", keywords: "cut trim timeline sequence", run: () => useTool("cut") },
    { id: "text", title: "Open Text styling", detail: "Fonts, heading styles, branding, and presets", category: "Navigate", keywords: "font typography title text", run: () => useTool("text") },
    { id: "captions", title: "Open Captions", detail: "Create, edit, and style subtitles", category: "Navigate", keywords: "subtitle srt speech transcript", run: () => useTool("captions") },
    { id: "fx", title: "Open Visual Effects", detail: "Adjust brightness, contrast, color, and speed", category: "Navigate", keywords: "filter saturation blur effects", run: () => useTool("fx") },
    { id: "audio", title: "Open Audio tools", detail: "Normalize audio and adjust volume", category: "Navigate", keywords: "sound music loudness", run: () => useTool("audio") },
    { id: "creator", title: "Open Creator Copilot", detail: "Highlights, chapters, captions, and platform checks", category: "Navigate", keywords: "ai creator ideas social media", run: () => useTool("creator") },
    { id: "upload", title: "Add video", detail: "Choose a source video from your device", category: "Project", keywords: "import media upload", run: () => clickAction("uploadBtn") },
    { id: "save", title: "Save project", detail: "Download a project file you can reopen later", category: "Project", keywords: "save export json backup", run: () => clickAction("saveProjectBtn") },
    { id: "open", title: "Open project", detail: "Load a saved ClipSmith project", category: "Project", keywords: "load restore json", run: () => clickAction("loadProjectBtn") },
    { id: "export", title: "Export clips", detail: "Open the export center and choose quality", category: "Export", keywords: "render mp4 download queue", run: () => clickAction("exportBtn") },
    { id: "undo", title: "Undo last edit", detail: "Revert the latest project change", category: "Edit", keywords: "back history ctrl z", run: () => clickAction("undoBtn") },
    { id: "redo", title: "Redo edit", detail: "Restore the edit you just undid", category: "Edit", keywords: "forward history ctrl shift z", run: () => clickAction("redoBtn") },
    { id: "focus", title: "Toggle Preview Focus", detail: "Give the preview more room on a laptop or desktop", category: "Workspace", keywords: "fullscreen hide panels canvas", run: () => clickAction("focusPreviewBtn") },
    { id: "power-tools", title: "Open Creator Power Tools", detail: "Frame-step, exact timecodes, markers, platform presets, preview speed and fast export", category: "Tools", keywords: "power tools markers loop frame rate speed snapshot captions presets", run: () => { if (window.ClipSmithPowerTools) window.ClipSmithPowerTools.open(); else clickAction("powerToolsBtn"); } },
    { id: "fit", title: "Fit timeline", detail: "Reset timeline zoom to 100% and scroll to the start", category: "Workspace", keywords: "zoom timeline reset", run: () => clickAction("timelineZoomFitBtn") },
    { id: "scenes", title: "Find scene cuts", detail: "Scan the loaded source for likely scene changes", category: "Tools", keywords: "scene detect split", run: () => clickAction("sceneScanBtn") },
    { id: "subtitles", title: "Generate auto subtitles", detail: "Open Captions and start on-device transcription", category: "Tools", keywords: "speech to text transcription", run: () => { useTool("captions"); clickAction("autoSubtitleBtn"); } },
    { id: "help", title: "Keyboard shortcuts", detail: "Review the shortcuts available in ClipSmith", category: "Help", keywords: "keyboard commands hotkeys", run: () => clickAction("keyboardHelpBtn") }
  ];

  function clickAction(id) {
    const button = document.getElementById(id);
    if (button && !button.disabled) button.click();
  }

  function useTool(name) {
    const shell = document.querySelector(".app-shell");
    const focus = document.getElementById("focusPreviewBtn");
    if (name !== "preview" && shell && shell.classList.contains("focus-preview") && focus) focus.click();
    const button = document.querySelector('.tool[data-tool="' + name + '"]') ||
      document.querySelector('.mobile-tab[data-tool="' + name + '"]');
    if (button) button.click();
  }

  function filteredActions() {
    const query = paletteSearch.value.trim().toLowerCase();
    if (!query) return actions;
    return actions.filter((action) =>
      (action.title + " " + action.detail + " " + action.category + " " + action.keywords).toLowerCase().includes(query)
    );
  }

  function renderActions() {
    const shown = filteredActions();
    activeCommand = Math.max(0, Math.min(activeCommand, shown.length - 1));
    paletteList.replaceChildren();
    if (!shown.length) {
      const empty = document.createElement("div");
      empty.className = "command-empty";
      empty.textContent = "No matching actions. Try another search.";
      paletteList.appendChild(empty);
      if (paletteHint) paletteHint.textContent = "0 matching actions";
      return;
    }
    shown.forEach((action, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "command-item";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === activeCommand));
      item.id = "command-option-" + action.id;
      const copy = document.createElement("span");
      copy.className = "command-item-copy";
      const title = document.createElement("span");
      title.className = "command-item-title";
      title.textContent = action.title;
      const detail = document.createElement("span");
      detail.className = "command-item-detail";
      detail.textContent = action.detail;
      copy.append(title, detail);
      const category = document.createElement("span");
      category.className = "command-item-category";
      category.textContent = action.category;
      item.append(copy, category);
      item.addEventListener("mouseenter", () => { activeCommand = index; syncActiveItem(); });
      item.addEventListener("click", () => executeAction(action));
      paletteList.appendChild(item);
    });
    if (paletteHint) paletteHint.textContent = shown.length + " action" + (shown.length === 1 ? "" : "s") + " available";
    syncActiveItem();
  }

  function syncActiveItem() {
    const items = [...paletteList.querySelectorAll(".command-item")];
    items.forEach((item, index) => item.setAttribute("aria-selected", String(index === activeCommand)));
    const active = items[activeCommand];
    if (active) {
      paletteSearch.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    } else {
      paletteSearch.removeAttribute("aria-activedescendant");
    }
  }

  function openPalette() {
    palette.classList.remove("hidden");
    paletteSearch.value = "";
    activeCommand = 0;
    renderActions();
    paletteSearch.focus({ preventScroll: true });
  }

  function closePalette(restoreFocus) {
    palette.classList.add("hidden");
    paletteSearch.removeAttribute("aria-activedescendant");
    if (restoreFocus) paletteTrigger.focus({ preventScroll: true });
  }

  function executeAction(action) {
    if (!action) return;
    closePalette(false);
    action.run();
  }

  paletteTrigger.addEventListener("click", openPalette);
  if (paletteClose) paletteClose.addEventListener("click", () => closePalette(true));
  palette.addEventListener("click", (event) => { if (event.target === palette) closePalette(true); });
  paletteSearch.addEventListener("input", () => { activeCommand = 0; renderActions(); });

  document.addEventListener("keydown", (event) => {
    if (palette.classList.contains("hidden")) return;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopImmediatePropagation(); closePalette(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); event.stopImmediatePropagation();
      const count = filteredActions().length;
      if (count) activeCommand = (activeCommand + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
      syncActiveItem();
    } else if (event.key === "Enter") {
      event.preventDefault(); event.stopImmediatePropagation();
      executeAction(filteredActions()[activeCommand]);
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
      event.preventDefault(); event.stopImmediatePropagation();
      if (palette.classList.contains("hidden")) openPalette();
      else closePalette(true);
    }
  }, true);
}
