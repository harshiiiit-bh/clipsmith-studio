const MAX_PROJECT_CLIPS = 10000;
const MIN_SPLIT_FRAGMENT_SECONDS = 0.5;
const MAX_AUTO_CLIPS = 5000;

/** Create a bounded clip plan; null signals a timeline too large for a sensible editor session. */
export function buildClipSegments(duration, clipSeconds = 30, options = {}) {
  const total = Number(duration);
  const step = Number(clipSeconds);
  const minSegment = Number.isFinite(Number(options.minSegmentSeconds)) && Number(options.minSegmentSeconds) > 0
    ? Number(options.minSegmentSeconds)
    : MIN_SPLIT_FRAGMENT_SECONDS;
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(step) || step <= 0) return [];
  const count = Math.ceil(total / step);
  if (count > MAX_AUTO_CLIPS) return null;
  const segments = [];
  for (let index = 0; index < count; index += 1) {
    const start = index * step;
    if (start >= total - 0.05) break;
    const end = Math.min(total, start + step);
    if (end - start < minSegment) break;
    segments.push({ start: Number(start.toFixed(3)), end: Number(end.toFixed(3)), index });
  }
  return segments;
}


/**
 * Build clips from the portions of a source video that remain after marked
 * promo/ad ranges are excluded. Boundaries always refer to the original file.
 */
export function buildClipSegmentsExcludingRanges(duration, clipSeconds = 30, skipRanges = [], options = {}) {
  const total = Number(duration);
  const step = Number(clipSeconds);
  const minSegment = Number.isFinite(Number(options.minSegmentSeconds)) && Number(options.minSegmentSeconds) > 0
    ? Number(options.minSegmentSeconds)
    : MIN_SPLIT_FRAGMENT_SECONDS;
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(step) || step <= 0) return [];

  const ranges = (Array.isArray(skipRanges) ? skipRanges : [])
    .map((range) => ({
      start: Math.max(0, Math.min(total, Number(range?.start))),
      end: Math.max(0, Math.min(total, Number(range?.end)))
    }))
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end - range.start >= 0.05)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 0.01) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  const kept = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start - cursor >= minSegment) kept.push([cursor, range.start]);
    cursor = Math.max(cursor, range.end);
  }
  if (total - cursor >= minSegment) kept.push([cursor, total]);

  const segments = [];
  for (const [rangeStart, rangeEnd] of kept) {
    for (let start = rangeStart; start < rangeEnd - 0.05; start += step) {
      const end = Math.min(rangeEnd, start + step);
      if (end - start < minSegment) break;
      segments.push({
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        index: segments.length
      });
      if (segments.length > MAX_AUTO_CLIPS) return null;
    }
  }
  return segments;
}

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
    title: clip.autoTitle ? optionTitle(options, index + 1, String(clip.title || "Clip") + " · continued") : String(clip.title || "Clip") + " · continued"
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
    title: clip.autoTitle ? optionTitle(options, index + 1, String(clip.title || "Clip") + " · copy") : String(clip.title || "Clip") + " · copy"
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

export function renumberAutoTitles(clips, titleFor) {
  if (!Array.isArray(clips) || typeof titleFor !== "function") return null;
  return clips.map((clip, index) => clip?.autoTitle
    ? { ...clip, title: String(titleFor(index)) }
    : clip);
}

function safeText(value, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);
}

function safeMultiline(value, max = 4000) {
  return String(value ?? "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, " ").trim().slice(0, max);
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
      duration: Number.isFinite(Number(project.sourceDuration)) ? Math.max(0, Number(project.sourceDuration)) : 0,
      url: safeText(project.sourceUrl, 2048)
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

  const fileSize = Number(value.source.fileSize);
  const duration = Number(value.source.duration);
  if (!Number.isFinite(fileSize) || fileSize < 0 || !Number.isFinite(duration) || duration < 0) return null;

  const clips = [];
  const ids = new Set();
  for (const raw of value.clips) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const start = Number(raw.start);
    const end = Number(raw.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return null;
    if (duration > 0 && end > duration + 0.05) return null;
    if (typeof raw.id !== "string" || !raw.id.trim() || raw.id.length > 160 || /[\u0000-\u001f]/.test(raw.id)) return null;
    if (ids.has(raw.id)) return null;
    ids.add(raw.id);
    clips.push({
      ...copyJSON(raw),
      id: safeText(raw.id, 160),
      start,
      end,
      title: safeText(raw.title, 500),
      caption: safeMultiline(raw.caption, 4000)
    });
  }

  return {
    format: "clipsmith-project",
    version: 1,
    savedAt: safeText(value.savedAt, 64),
    projectName: safeText(value.projectName || "Untitled project", 120),
    source: {
      fileName: safeText(value.source.fileName, 240),
      fileSize,
      duration,
      url: safeText(value.source.url, 2048)
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
    const value = type === "checkbox" || type === "radio" ? Boolean(entry.value ?? entry.checked) : safeText(entry.value, 2000);
    snapshot[key] = { type, value };
  }
  return snapshot;
}

/** Remove a clip and immediately close numbering gaps without overwriting custom titles. */
export function removeClipAndRenumber(clips, clipId, options = {}) {
  if (!Array.isArray(clips)) return null;
  const index = clips.findIndex(clip => clip.id === clipId);
  if (index < 0) return null;
  let result = clips.filter(clip => clip.id !== clipId);
  if (typeof options.titleFor === 'function') result = renumberAutoTitles(result, options.titleFor);
  const selectedIndex = Math.min(index, result.length - 1);
  return { clips: result, selectedId: result[selectedIndex]?.id ?? null };
}

/** Keep scene-change candidates above threshold while suppressing adjacent duplicate suggestions. */
export function rankSceneChanges(samples, options = {}) {
  const threshold = Number.isFinite(Number(options.threshold)) ? Number(options.threshold) : 0.42;
  const minGap = Math.max(0, Number(options.minGap) || 1.2);
  const sorted = (Array.isArray(samples) ? samples : []).map(sample => ({
    time: Number(sample?.time), score: Number(sample?.score)
  })).filter(sample => Number.isFinite(sample.time) && sample.time >= 0 && Number.isFinite(sample.score) && sample.score >= threshold).sort((a,b)=>a.time-b.time);
  const accepted = [];
  for (const item of sorted) {
    const previous = accepted[accepted.length - 1];
    if (previous && item.time - previous.time < minGap) { if (item.score > previous.score) accepted[accepted.length - 1] = item; continue; }
    accepted.push(item);
  }
  return accepted;
}
