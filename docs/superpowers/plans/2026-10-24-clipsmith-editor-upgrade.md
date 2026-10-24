# ClipSmith Editor Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild ClipSmith into a fixed-workspace browser editor with resilient exports and a privacy-first creator assistant.

**Architecture:** Keep GitHub Pages/static hosting. Split the monolithic page into focused `index.html`, `styles.css`, and `app.js`; preserve FFmpeg WASM as the compatibility renderer while routing lightweight preview/UI work through browser APIs. Store editor state locally and process export jobs serially.

**Tech Stack:** HTML/CSS/JavaScript, browser Media APIs, IndexedDB/localStorage, FFmpeg WASM 0.12.x, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-24-clipsmith-studio-upgrade.md`

## Global Constraints
- Media processing is local-first; no mandatory server upload.
- Mobile UI must avoid a page-length clip-card wall.
- Export must process one job at a time and release object URLs/blobs after use.
- Creator suggestions must only use information actually available to the app.
- Existing title, caption, clip and FX workflows must continue working.

## Review Focus
- Large input video + many clips: export queue must not retain every output in memory.
- Mobile viewport: controls must remain reachable without endless scrolling.
- Missing/unsupported browser APIs: app must degrade gracefully.
- Empty creator context: suggestions must still be useful but clearly generic.
- Repeated export/retry: temporary files and object URLs must be cleaned up.

---

### Task 1: Split the shell and editor workspace
**Files:**
- Modify: `index.html`
- Create: `styles.css`
- Create: `app.js`

- [ ] Write a smoke test that checks the new shell contains `app-shell`, `tool-rail`, `preview-stage`, `inspector`, and `timeline`.
- [ ] Replace the long stacked form with the fixed editor shell and compact clip strip.
- [ ] Add responsive desktop/tablet/mobile layouts and bottom-sheet inspector behavior.
- [ ] Run the smoke test and inspect the deployed DOM for the required landmarks.
- [ ] Commit: `feat: rebuild clipsmith editor workspace`

### Task 2: Move editor state into a single project model
**Files:**
- Modify: `app.js`
- Modify: `tests/smoke.mjs`

- [ ] Add tests for project defaults, clip numbering, selection, and series title propagation.
- [ ] Implement `createProjectState()`, `createClip()`, `selectClip()`, `applySeriesTitle()`, and `persistProject()`.
- [ ] Wire title, caption, FX, ratio and clip edits to the model instead of scattered DOM state.
- [ ] Add undo/redo snapshots with a bounded history.
- [ ] Commit: `refactor: centralize clipsmith project state`

### Task 3: Build visual editing controls
**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

- [ ] Add preview overlay rendering for title/caption placement and safe-zone guides.
- [ ] Add ratio presets, crop controls, split-at-playhead, duplicate, delete, reorder and timeline zoom.
- [ ] Keep the inspector contextual so only relevant controls are visible.
- [ ] Commit: `feat: add visual clip editing workflow`

### Task 4: Add Creator Intelligence panel
**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`
- Modify: `tests/smoke.mjs`

- [ ] Test caption/title/hashtag generation from a supplied context string.
- [ ] Implement deterministic local generators for hooks, captions, titles, descriptions, CTAs, keywords and hashtags.
- [ ] Add platform presets and tone presets with copy/regenerate controls.
- [ ] Add optional transcript/context input; do not fabricate semantic video understanding.
- [ ] Commit: `feat: add local creator intelligence`

### Task 5: Replace fragile export with a resilient queue
**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `tests/smoke.mjs`

- [ ] Test serial queue ordering and cleanup hooks.
- [ ] Implement `ExportQueue` with one active job, progress, cancellation, retries and per-job status.
- [ ] Add capability detection and a fallback ladder for stream-copy/re-encode quality modes.
- [ ] Revoke object URLs immediately after download and clear temporary references between jobs.
- [ ] Replace generic export toast with a recovery panel showing the exact mode and next action.
- [ ] Commit: `fix: harden mobile and large-video exports`

### Task 6: Persistence, polish and verification
**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `README.md`
- Modify: `.github/workflows/clip-smoke.yml`

- [ ] Add autosave/recovery status and recent-project metadata.
- [ ] Add keyboard shortcuts on desktop and touch-friendly controls on mobile.
- [ ] Run syntax checks, smoke tests, and GitHub Actions.
- [ ] Verify the live GitHub Pages deployment and confirm the new editor landmarks are present.
- [ ] Commit: `chore: verify clipsmith editor release`
