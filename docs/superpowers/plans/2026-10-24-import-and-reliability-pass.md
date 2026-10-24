# ClipSmith Import & Reliability Implementation Plan

> For agentic workers: implement task-by-task and verify each task with tests.

**Goal:** Make import, automatic clipping, local recovery, preview edits and Smart export more predictable for mobile users.

**Architecture:** Use a pure segment planner at video-metadata readiness. Preserve source identity for relinking. Correct snapshot-based Undo/Redo; keep optional frame analysis off the startup path; use stream-copy only when possible and retry compatible encoding in Smart mode.

**Tech Stack:** Static HTML/CSS/ES modules, FFmpeg.wasm, Node smoke tests, TensorFlow.js + COCO-SSD on demand.

**Spec:** `docs/superpowers/specs/2026-10-24-import-and-reliability-pass.md`

## Global constraints
- Media stays in the browser; no source uploads.
- Direct links require CORS and are capped at 300 MB.
- Generated clip plans are capped at 5,000 segments.
- Vision dependencies load only after the user requests frame analysis.
- Export remains serial to reduce peak browser memory.

## Review focus
- Zero-duration/tiny sources do not create phantom clips.
- Restored projects require relinking and never retain a stale video file.
- New source metadata mismatch discards stale segments.
- HTML responses, HTTP errors, oversized URLs and CORS failures have actionable messages.
- Original Stream mode does not silently re-encode FX; Smart mode retries ordinary stream-copy failures.

---

### Task 1 — Clip planning
- [x] Add the bounded, testable `buildClipSegments(duration, clipSeconds, options)` helper.
- [x] Test regular splits, a shorter final segment, zero duration and tiny fragments.

### Task 2 — Import and recovery
- [x] Add primary empty-state import and direct-link UI.
- [x] Auto-plan on metadata readiness.
- [x] Persist source identity and clearly require relinking after reload/project open.

### Task 3 — Editor state and preview
- [x] Record the previous snapshot for Undo/Redo.
- [x] Persist title/caption/FX controls.
- [x] Mirror FX in the preview and stop playback at selected clip boundaries.

### Task 4 — Export and creator context
- [x] Retry Smart-mode stream-copy errors with MP4 encoding.
- [x] Add real FFmpeg loudness normalization on export.
- [x] Add optional current-frame object detection to enrich creator suggestions.
- [ ] Confirm current CI and Pages deployment status.
