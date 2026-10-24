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
        block.style.width = `${Math.max(3, baseWidth * zoom)}%`;
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
