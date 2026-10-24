const MAX_PROJECT_CLIPS = 10000;
const MIN_SPLIT_FRAGMENT_SECONDS = 0.5;

function copyJSON(value) {
  return JSON.parse(JSON.stringify(value));
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? "clip-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function optionId(options) {
  return typeof options?.makeId === "function" ? options.makeId() : newId();
}

function optionTitle(options, index, fallback) {
  return typeof options?.titleFor === "function" ? String(options.titleFor(index) ?? fallback) : fallback;
}

export function splitClipAt(clips, clipId, position, options = {}) {
  if (!Array.isArray(clips)) return null;
  const index = clips.findIndex((clip) => clip.id === clipId);
  if (index < 0) return null;

  const clip = clips[index];
  const at = Number(position);
  const min = Number.isFinite(options.minFragmentSeconds) && options.minFragmentSeconds > 0
    ? options.minFragmentSeconds
    : MIN_SPLIT_FRAGMENT_SECONDS;
  if (!Number.isFinite(at) || at - clip.start < min || clip.end - at < min) return null;

  const left = { ...copyJSON(clip), end: at };
  const right = {
    ...copyJSON(clip),
    id: optionId(options),
    start: at,
    title: optionTitle(options, index + 1, String(clip.title || "Clip") + " · continued")
  };
  const result = clips.slice();
  result.splice(index, 1, left, right);
  return { clips: result, selectedId: right.id };
}

export function duplicateClip(clips, clipId, options = {}) {
  if (!Array.isArray(clips)) return null;
  const index = clips.findIndex((clip) => clip.id === clipId);
  if (index < 0) return null;
  const clip = clips[index];
  const duplicate = {
    ...copyJSON(clip),
    id: optionId(options),
    title: optionTitle(options, index + 1, String(clip.title || "Clip") + " · copy")
  };
  const result = clips.slice();
  result.splice(index + 1, 0, duplicate);
  return { clips: result, selectedId: duplicate.id };
}

export function moveClip(clips, clipId, direction) {
  if (!Array.isArray(clips)) return null;
  const index = clips.findIndex((clip) => clip.id === clipId);
  const delta = direction === "earlier" ? -1 : direction === "later" ? 1 : Number(direction);
  if (index < 0 || !Number.isInteger(delta) || Math.abs(delta) !== 1) return null;
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= clips.length) return null;
  const result = clips.slice();
  [result[index], result[nextIndex]] = [result[nextIndex], result[index]];
  return { clips: result, selectedId: clipId };
}

function safeText(value, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);
}

export function createProjectManifest(project = {}, savedAt = new Date().toISOString()) {
  const clips = Array.isArray(project.clips) ? copyJSON(project.clips) : [];
  return {
    format: "clipsmith-project",
    version: 1,
    savedAt: safeText(savedAt, 64),
    projectName: safeText(project.projectName || "Untitled project", 120),
    source: {
      fileName: safeText(project.sourceFileName, 240),
      fileSize: Number.isFinite(Number(project.sourceFileSize)) ? Math.max(0, Number(project.sourceFileSize)) : 0,
      duration: Number.isFinite(Number(project.sourceDuration)) ? Math.max(0, Number(project.sourceDuration)) : 0
    },
    controls: project.controls && typeof project.controls === "object" && !Array.isArray(project.controls)
      ? copyJSON(project.controls)
      : {},
    clips
  };
}

export function validateProjectManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (value.format !== "clipsmith-project" || value.version !== 1) return null;
  if (!Array.isArray(value.clips) || value.clips.length > MAX_PROJECT_CLIPS) return null;
  if (!value.source || typeof value.source !== "object" || Array.isArray(value.source)) return null;
  if (typeof value.controls !== "object" || value.controls === null || Array.isArray(value.controls)) return null;

  const clips = [];
  for (const raw of value.clips) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const start = Number(raw.start);
    const end = Number(raw.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return null;
    if (typeof raw.id !== "string" || !raw.id.trim() || raw.id.length > 160) return null;
    clips.push({
      ...copyJSON(raw),
      id: safeText(raw.id, 160),
      start,
      end,
      title: safeText(raw.title, 500),
      caption: safeText(raw.caption, 4000)
    });
  }

  const fileSize = Number(value.source.fileSize);
  const duration = Number(value.source.duration);
  if (!Number.isFinite(fileSize) || fileSize < 0 || !Number.isFinite(duration) || duration < 0) return null;

  return {
    format: "clipsmith-project",
    version: 1,
    savedAt: safeText(value.savedAt, 64),
    projectName: safeText(value.projectName || "Untitled project", 120),
    source: {
      fileName: safeText(value.source.fileName, 240),
      fileSize,
      duration
    },
    controls: copyJSON(value.controls),
    clips
  };
}

export function projectControlsToSnapshot(controls) {
  const snapshot = {};
  for (const [key, entry] of Object.entries(controls ?? {})) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(key)) continue;
    if (!entry || typeof entry !== "object") continue;
    const type = entry.type === "checkbox" || entry.type === "radio" ? entry.type : "value";
    const value = type === "checkbox" || type === "radio" ? Boolean(entry.checked) : safeText(entry.value, 2000);
    snapshot[key] = { type, value };
  }
  return snapshot;
}
