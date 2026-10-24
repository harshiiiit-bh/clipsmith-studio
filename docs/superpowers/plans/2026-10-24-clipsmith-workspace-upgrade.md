# ClipSmith Creator Workspace Upgrade Implementation Plan

> **For agentic workers:** Execute task-by-task with test-first changes. Steps use checkbox syntax for tracking.

**Goal:** Add reliable timeline editing, undo/redo, portable project recovery, and actionable export recovery to the existing browser-first ClipSmith Studio.

**Architecture:** A small pure-logic module owns clip-sequence operations and project-manifest validation. The existing application module keeps DOM, FFmpeg, local draft persistence and download wiring, avoiding an unnecessary full engine migration.

**Tech Stack:** Static HTML/CSS/ES modules, Node 22 built-in assertions, existing FFmpeg.wasm engine, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-24-clipsmith-workspace-design.md`

## Global Constraints
- Never upload or persist source-video bytes.
- Keep existing element IDs, export formats, subtitles, FX, and creator-ideas behavior working.
- Project manifests are versioned JSON and must be validated before restoring.
- Original-stream failure must not silently trigger a memory-heavy encode for large sources.
- Preserve responsive viewport constraints and mobile safe-area padding.
- Use no paid API or SDK and add no runtime dependency for timeline operations.

## Review Focus
- Invalid split points at/beyond clip boundaries; test must return no edit and preserve input.
- Duplicate clip with nested styles; test must ensure the copy is independent of the original.
- Malformed project import; test must reject invalid schema and invalid clip times.
- Browser local storage unavailable/quota exceeded; autosave must fail gracefully without blocking editing.
- Export stream-copy failure on a large file; UI recovery must not silently trigger a full re-encode.

---

### Task 1: Pure timeline and project helpers

**Files:**
- Create: `editor-tools.js`
- Modify: `tests/smoke.mjs`

**Interfaces:**
- `splitClipAt(clips, clipId, position, options) -> {clips, selectedId} | null`
- `duplicateClip(clips, clipId, options) -> {clips, selectedId} | null`
- `moveClip(clips, clipId, direction) -> {clips, selectedId} | null`
- `createProjectManifest(project, savedAt) -> manifest`
- `validateProjectManifest(value) -> manifest | null`

**Steps:**
- [ ] Add assertions for split boundaries, copy independence, adjacent reorder, manifest version/source metadata, and invalid imports.
- [ ] Run the smoke test and confirm it fails because the helper module is missing.
- [ ] Implement the minimal pure helpers in `editor-tools.js`.
- [ ] Run the smoke test and confirm those assertions pass.

### Task 2: Timeline toolbar and undo/redo

**Files:**
- Modify: `index.html`
- Test: `tests/smoke.mjs`

**Interfaces:**
- Import timeline helpers from `editor-tools.js`.
- Add timeline actions with stable IDs: `splitAtPlayheadBtn`, `duplicateClipBtn`, `moveClipEarlierBtn`, `moveClipLaterBtn`, `undoBtn`, `redoBtn`.
- Keep the model state in the existing `clips` array and call the existing render/update functions after mutations.

**Steps:**
- [ ] Assert required toolbar, undo/redo controls, and keyboard-accessible labels exist.
- [ ] Integrate history snapshots for model edits and inline clip title/caption changes; undo and redo restore clips and refresh the UI.
- [ ] Wire split/duplicate/reorder/delete controls to helper functions and disable controls when their action is unavailable.
- [ ] Run the complete smoke test and JS module syntax check.

### Task 3: Project save, import, and local draft recovery

**Files:**
- Modify: `index.html`
- Test: `tests/smoke.mjs`

**Interfaces:**
- Add top-bar `saveProjectBtn` and `loadProjectBtn` controls plus a hidden project JSON input.
- Portable project JSON includes controls, clip metadata/styles, source filename/size/duration metadata, and schema version; it excludes video bytes.
- Local draft key: `clipsmith.project.v1`.

**Steps:**
- [ ] Add failing assertions for save/load UI, the privacy boundary, and restore validation.
- [ ] Implement versioned export/import, best-effort local autosave, and same-source matching by file name and size.
- [ ] Confirm malformed manifests and storage failures show a readable message instead of breaking the editor.
- [ ] Run the full smoke test.

### Task 4: Safe export recovery

**Files:**
- Modify: `index.html`
- Test: `tests/smoke.mjs`

**Interfaces:**
- Add a recovery panel under the export progress area with actions to use stream-copy, disable burn-in/FX/crop, and retry one clip.
- Keep the existing `showExportFailure(error)` diagnostic entry point.

**Steps:**
- [ ] Add assertions that recovery actions exist and a large-file stream-copy error does not force an encode retry.
- [ ] Wire the controls to settings and the individual-export path.
- [ ] Change the automatic compatibility fallback so a large source fails with clear guidance rather than being silently re-encoded.
- [ ] Run the full smoke test and inspect the error-recovery code path.

### Task 5: Final validation and publish

**Files:**
- Modify: `README.md` if behavior changes require documentation.

**Steps:**
- [ ] Run `node tests/smoke.mjs` via GitHub Actions and confirm success.
- [ ] Check the PR diff for accidentally changed export behavior and verify all acceptance criteria against the implementation.
- [ ] Merge only after checks pass, then confirm the Pages source commit and public page response.
