(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const BUILD = "20261024-power3";
  const modal = $("powerToolsModal");
  const video = $("previewVideo");
  const prefixStorageKey = "clipsmith.power-export-prefix.v1";
  const markerStoragePrefix = "clipsmith.power-markers.v1:";
  let loopClipId = null;
  let initialized = false;

  function notify(message, type = "info") {
    const app = window.ClipSmithStudio;
    if (app && typeof app.toast === "function") {
      app.toast(message, type);
      return;
    }
    let toast = $(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("show");
  }

  function safeName(value) {
    return String(value || "clipsmith")
      .normalize("NFKC")
      .replace(/[^\w\u00C0-\uFFFF-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "clipsmith";
  }

  function api() {
    return window.ClipSmithStudio || null;
  }

  function currentClip() {
    return api()?.getSelectedClip?.() || null;
  }

  function currentProjectKey() {
    return markerStoragePrefix + safeName(api()?.getProjectName?.() || "Untitled Project");
  }

  function formatTimecode(value) {
    const seconds = Math.max(0, Number(value) || 0);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const wholeSeconds = Math.floor(seconds % 60);
    const millis = Math.floor((seconds - Math.floor(seconds)) * 1000);
    return String(hours).padStart(2, "0") + ":" +
      String(minutes).padStart(2, "0") + ":" +
      String(wholeSeconds).padStart(2, "0") + "." +
      String(millis).padStart(3, "0");
  }

  function parseTimecode(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    if (!raw.includes(":")) {
      const seconds = Number(raw);
      return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
    }
    const parts = raw.split(":");
    if (parts.length !== 2 && parts.length !== 3) return null;
    if (parts.some((part) => part.trim() === "" || !Number.isFinite(Number(part)))) return null;
    const seconds = Number(parts[parts.length - 1]);
    const minutes = Number(parts[parts.length - 2]);
    const hours = parts.length === 3 ? Number(parts[0]) : 0;
    if (hours < 0 || minutes < 0 || seconds < 0 || seconds >= 60 ||
        (parts.length === 3 && minutes >= 60)) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }

  async function copyText(value, successMessage) {
    const text = String(value || "").trim();
    if (!text) {
      notify("Nothing to copy yet.", "error");
      return false;
    }
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const field = document.createElement("textarea");
        field.value = text;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        if (!copied) throw new Error("Clipboard permission unavailable");
      }
      notify(successMessage || "Copied to clipboard.");
      return true;
    } catch {
      notify("Clipboard access was blocked by this browser.", "error");
      return false;
    }
  }

  function openModal() {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    syncControls();
    renderMarkers();
    $("closePowerToolsBtn")?.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    $("powerToolsBtn")?.focus({ preventScroll: true });
  }

  function seekTo(time) {
    const app = api();
    if (!app) {
      notify("The editor has not finished starting. Reload the page and try again.", "error");
      return false;
    }
    const duration = Number(app.getDuration?.()) || 0;
    if (!video || video.readyState < 1 || !(duration > 0)) {
      notify("Load a video before seeking.", "error");
      return false;
    }
    const target = Math.min(duration, Math.max(0, Number(time) || 0));
    try {
      app.seekTo?.(target);
      video.currentTime = target;
      if ($("seekBar")) $("seekBar").value = String(target / duration * 100);
      if ($("powerTimecodeInput")) $("powerTimecodeInput").value = formatTimecode(target);
      if ($("powerCurrentTime")) $("powerCurrentTime").textContent = formatTimecode(target);
      return true;
    } catch {
      notify("The preview could not seek to that time yet.", "error");
      return false;
    }
  }

  function syncControls() {
    const clip = currentClip();
    const ready = Boolean(api() && video && video.readyState >= 1);
    const now = Number(video?.currentTime) || 0;
    const speed = Number(clip?.speed) || 1;
    const muted = Boolean(clip?.muted);
    if ($("powerCurrentTime")) $("powerCurrentTime").textContent = formatTimecode(now);
    if ($("powerTimecodeInput") && document.activeElement !== $("powerTimecodeInput")) {
      $("powerTimecodeInput").value = formatTimecode(now);
    }
    if ($("powerSpeedSelect")) $("powerSpeedSelect").value = String(speed);
    if ($("powerMuteBtn")) {
      $("powerMuteBtn").textContent = muted ? "Unmute preview" : "Mute preview";
      $("powerMuteBtn").setAttribute("aria-pressed", String(muted));
    }
    if ($("powerLoopBtn")) {
      const active = Boolean(loopClipId && clip?.id === loopClipId);
      $("powerLoopBtn").textContent = active ? "Looping selected clip ✓" : "Loop selected clip";
      $("powerLoopBtn").setAttribute("aria-pressed", String(active));
    }
    ["powerPreviousFrameBtn", "powerNextFrameBtn", "powerGoTimeBtn", "powerCopyTimeBtn",
      "powerMuteBtn", "powerSnapshotBtn"].forEach((id) => {
      const button = $(id);
      if (button) button.disabled = !ready;
    });
    if ($("powerLoopBtn")) $("powerLoopBtn").disabled = !ready || !clip;
    if ($("powerExportSelectedBtn")) $("powerExportSelectedBtn").disabled = !clip || !api();
    if ($("powerResetEffectsBtn")) $("powerResetEffectsBtn").disabled = !api();
    if ($("powerApplyTitleBtn")) $("powerApplyTitleBtn").disabled = !clip || !api();
    if ($("powerApplyCaptionBtn")) $("powerApplyCaptionBtn").disabled = !clip || !api();
    if ($("powerCopyCaptionBtn")) $("powerCopyCaptionBtn").disabled = !clip;
  }

  function moveFrame(direction) {
    const fps = Math.max(1, Number($("powerFrameRate")?.value) || 30);
    if (!video || video.readyState < 1) return notify("Load a video before frame stepping.", "error");
    const time = (Number(video.currentTime) || 0) + direction / fps;
    seekTo(time);
  }

  function markerRead() {
    try {
      const saved = JSON.parse(localStorage.getItem(currentProjectKey()) || "[]");
      return Array.isArray(saved) ? saved.filter((item) => item && typeof item.id === "string" &&
        Number.isFinite(Number(item.time)) && Number(item.time) >= 0).slice(0, 60) : [];
    } catch {
      return [];
    }
  }

  function markerWrite(items) {
    try {
      localStorage.setItem(currentProjectKey(), JSON.stringify(items.slice(0, 60)));
      return true;
    } catch {
      notify("Could not save markers in this browser's local storage.", "error");
      return false;
    }
  }

  function renderMarkers() {
    const root = $("powerMarkerList");
    if (!root) return;
    root.replaceChildren();
    const markers = markerRead();
    if (!markers.length) {
      const empty = document.createElement("p");
      empty.className = "power-empty";
      empty.textContent = "No markers yet. Save a moment worth returning to.";
      root.appendChild(empty);
      return;
    }
    markers.forEach((marker) => {
      const row = document.createElement("div");
      row.className = "power-marker-row";
      const jump = document.createElement("button");
      jump.type = "button";
      jump.className = "power-marker-jump";
      jump.textContent = marker.label + " · " + formatTimecode(marker.time);
      jump.title = "Jump to " + formatTimecode(marker.time);
      jump.addEventListener("click", () => seekTo(marker.time));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "power-marker-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Delete marker " + marker.label);
      remove.addEventListener("click", () => {
        markerWrite(markerRead().filter((item) => item.id !== marker.id));
        renderMarkers();
      });
      row.append(jump, remove);
      root.appendChild(row);
    });
  }

  function saveMarker() {
    if (!video || video.readyState < 1) return notify("Load a video before saving a marker.", "error");
    const label = String($("powerMarkerLabel")?.value || "").trim().slice(0, 60) ||
      "Marker " + (markerRead().length + 1);
    const markers = markerRead();
    if (markers.length >= 60) return notify("This project already has 60 markers. Delete one to add another.", "error");
    markers.push({ id: (window.crypto?.randomUUID?.() || String(Date.now()) + Math.random()), label,
      time: Number(video.currentTime) || 0, createdAt: new Date().toISOString() });
    if (markerWrite(markers)) {
      if ($("powerMarkerLabel")) $("powerMarkerLabel").value = "";
      renderMarkers();
      notify("Marker saved on this device.");
    }
  }

  function applyAspectPreset(ratio) {
    const preview = $("aspectSelect");
    const output = $("exportAspectSelect");
    if (preview) {
      preview.value = ratio;
      preview.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (output) {
      output.value = ratio;
      output.dispatchEvent(new Event("change", { bubbles: true }));
    }
    document.querySelectorAll("[data-power-aspect]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.powerAspect === ratio);
    });
    notify("Workspace and export preset set to " + ratio + ".");
  }

  function applyTitleTemplate() {
    const app = api();
    const clip = currentClip();
    if (!app || !clip) return notify("Select a clip first to apply a title template.", "error");
    const project = app.getProjectName?.() || "Untitled Project";
    const index = Number(clip.index) || 1;
    const templates = {
      hook: { text: "STOP SCROLLING.", style: { font: "Anton", size: 44, color: "#ffffff", outline: "#111111", bold: true, italic: false, shadow: 10, spacing: 0 } },
      part: { text: project + " · Part " + index, style: { font: "Bebas Neue", size: 42, color: "#ffffff", outline: "#17131e", bold: true, italic: false, shadow: 8, spacing: 1 } },
      question: { text: "WAIT… DID YOU SEE THAT?", style: { font: "Bangers", size: 40, color: "#ffe58c", outline: "#17131e", bold: true, italic: false, shadow: 8, spacing: 0 } },
      minimal: { text: project, style: { font: "Manrope", size: 28, color: "#f6f7fb", outline: "#000000", bold: true, italic: false, shadow: 4, spacing: 0 } },
      cinematic: { text: "A MOMENT TO REMEMBER", style: { font: "Playfair Display", size: 36, color: "#fff1d5", outline: "#090909", bold: false, italic: true, shadow: 6, spacing: 1 } }
    };
    const chosen = templates[$("powerTitleTemplate")?.value || "hook"];
    if (app.setSelectedTitle(chosen.text, chosen.style)) notify("Title template applied. Fine-tune it in Text.");
    syncControls();
  }

  function applyCaptionTemplate() {
    const app = api();
    const clip = currentClip();
    if (!app || !clip) return notify("Select a clip first to apply a caption template.", "error");
    const templates = {
      punchy: { text: "WAIT FOR IT 👀", style: { style: "Karaoke", highlight: "#9d7cff", positionY: 82 } },
      context: { text: "HERE'S WHAT HAPPENED", style: { style: "Classic", highlight: "#ffffff", positionY: 80 } },
      reaction: { text: "NO WAY 😭", style: { style: "Pop", highlight: "#ffe36e", positionY: 83 } },
      clean: { text: "Add your dialogue here", style: { style: "Cinematic", highlight: "#ffffff", positionY: 78 } }
    };
    const chosen = templates[$("powerCaptionTemplate")?.value || "punchy"];
    if (app.setSelectedCaption(chosen.text, chosen.style)) notify("Caption template applied to the selected clip.");
    syncControls();
  }

  async function snapshotFrame() {
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      return notify("Load a video and wait for the preview frame before capturing it.", "error");
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Frame capture failed")), "image/png");
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const name = safeName($("powerExportPrefix")?.value || api()?.getProjectName?.() || "clipsmith");
      anchor.href = url;
      anchor.download = name + "-" + formatTimecode(video.currentTime).replace(/[:.]/g, "-") + ".png";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify("Current frame saved as PNG.");
    } catch (error) {
      notify("Could not capture this frame. Cross-origin video hosts may block screenshots.", "error");
    }
  }

  async function exportSelected() {
    const app = api();
    const button = $("powerExportSelectedBtn");
    if (!app?.exportSelectedClip) return notify("Editor export controls are not ready.", "error");
    if (button) button.disabled = true;
    try {
      await app.exportSelectedClip();
    } catch (error) {
      notify(error?.message || "Selected clip export failed.", "error");
    } finally {
      syncControls();
    }
  }

  function bind(id, event, handler) {
    const node = $(id);
    if (node) node.addEventListener(event, handler);
  }

  function init() {
    if (initialized || !modal) return;
    initialized = true;

    bind("powerToolsBtn", "click", openModal);
    bind("powerToolsMobileBtn", "click", openModal);
    bind("closePowerToolsBtn", "click", closeModal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
    bind("powerPreviousFrameBtn", "click", () => moveFrame(-1));
    bind("powerNextFrameBtn", "click", () => moveFrame(1));
    bind("powerGoTimeBtn", "click", () => {
      const target = parseTimecode($("powerTimecodeInput")?.value);
      if (target === null) return notify("Use seconds, MM:SS, or HH:MM:SS.mmm.", "error");
      seekTo(target);
    });
    bind("powerTimecodeInput", "keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        $("powerGoTimeBtn")?.click();
      }
    });
    bind("powerCopyTimeBtn", "click", () => copyText(formatTimecode(video?.currentTime), "Timecode copied."));
    bind("powerSaveMarkerBtn", "click", saveMarker);
    bind("powerMarkerLabel", "keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveMarker();
      }
    });
    bind("presetShortsBtn", "click", () => applyAspectPreset("9:16"));
    bind("presetYouTubeBtn", "click", () => applyAspectPreset("16:9"));
    bind("presetSquareBtn", "click", () => applyAspectPreset("1:1"));
    bind("presetFeedBtn", "click", () => applyAspectPreset("4:5"));
    bind("powerSpeedSelect", "change", (event) => {
      const app = api();
      if (!app?.setPlaybackSpeed) return notify("Editor controls are not ready.", "error");
      app.setPlaybackSpeed(Number(event.target.value));
      syncControls();
    });
    bind("powerMuteBtn", "click", () => {
      const clip = currentClip();
      const app = api();
      if (!app?.setPreviewMuted) return;
      app.setPreviewMuted(!clip?.muted);
      syncControls();
    });
    bind("powerLoopBtn", "click", () => {
      const clip = currentClip();
      if (!clip || !video || video.readyState < 1) return notify("Select a clip and load a video first.", "error");
      loopClipId = loopClipId === clip.id ? null : clip.id;
      syncControls();
      notify(loopClipId ? "Clip loop enabled for the selected range." : "Clip loop disabled.");
    });
    bind("powerSnapshotBtn", "click", snapshotFrame);
    bind("powerTitleTemplate", "change", syncControls);
    bind("powerApplyTitleBtn", "click", applyTitleTemplate);
    bind("powerApplyCaptionBtn", "click", applyCaptionTemplate);
    bind("powerCopyCaptionBtn", "click", () => {
      const clip = currentClip();
      copyText(clip?.caption || $("captionOverlay")?.textContent || "", "Caption copied.");
    });
    bind("powerResetEffectsBtn", "click", () => {
      const app = api();
      if (app?.resetSelectedEffects?.()) notify("Selected clip effects reset.");
      syncControls();
    });
    bind("powerExportSelectedBtn", "click", exportSelected);
    bind("powerExportPrefix", "input", (event) => {
      try { localStorage.setItem(prefixStorageKey, event.target.value.slice(0, 48)); } catch {}
    });
    try {
      $("powerExportPrefix").value = localStorage.getItem(prefixStorageKey) || "";
    } catch {}
    if (video) {
      video.addEventListener("timeupdate", () => {
        const time = Number(video.currentTime) || 0;
        if ($("powerCurrentTime")) $("powerCurrentTime").textContent = formatTimecode(time);
        const clip = currentClip();
        if (!loopClipId) return;
        if (!clip || clip.id !== loopClipId) {
          loopClipId = null;
          syncControls();
          return;
        }
        const stopAt = Math.max(clip.start, clip.end - Math.min(0.04, (clip.end - clip.start) / 5));
        if (time >= stopAt) {
          video.currentTime = clip.start;
          video.play().catch(() => {});
        }
      });
      video.addEventListener("loadedmetadata", syncControls);
      video.addEventListener("play", syncControls);
      video.addEventListener("pause", syncControls);
    }
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (event.key === "Escape" && !modal.classList.contains("hidden")) {
        event.preventDefault();
        closeModal();
        return;
      }
      if (!typing && event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        openModal();
      }
    });
    window.addEventListener("clipsmith:app-ready", syncControls);
    syncControls();
  }

  window.ClipSmithPowerTools = { build: BUILD, open: openModal, close: closeModal, parseTimecode, formatTimecode };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
