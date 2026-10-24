# ClipSmith Creator Workspace Upgrade — Design

**Date:** 2026-10-24

## Intent
Make ClipSmith easier to operate on phones and desktop without replacing its existing browser-local FFmpeg and creator-ideas pipeline. The user needs a better editing flow, direct timeline actions, recoverable projects, and useful next steps when export fails.

## Current state
The site already has a compact three-pane workspace, mobile tabs, a browser-local caption/hashtag helper, optional local object detection, title/caption styling, and FFmpeg/WASM export. The highest-value gaps are timeline-level edit actions and history, project recovery that doesn't retain video bytes, and an export failure flow with safe, explicit retry actions. The current stream-copy path can silently fall back to a memory-heavy encode when a stream-copy command fails, which is undesirable on large files/mobile browsers.

## Goals
- Let users split a selected clip at the playhead, duplicate it, reorder it, and delete it without hunting through clip cards.
- Provide working Undo/Redo for clip-sequence mutations and inline clip-title/caption edits.
- Export/import a portable project manifest and autosave the edit recipe locally; never save source-video bytes.
- Replace generic export failure messaging with practical diagnostics and one-tap safe recovery choices.
- Keep existing creator ideas, FX, titles, subtitles, FFmpeg and existing element IDs functioning.
- Preserve the compact viewport-based workspace and ensure the mobile bottom navigation is not covered by controls.

## Non-goals
- No server upload, paid-key requirement, cloud project storage, or video ripping.
- No promise of lossless re-encoding; no dependency on a paid editing SDK.
- No automatic AI claims beyond the existing local heuristics and optional object labels.

## Approaches considered
1. Add more controls to the existing stacked page. Rejected: it would amplify the control density and make the mobile experience harder to use.
2. Rebuild the site around the new rendering/codec stack immediately. Deferred: this expands codec, browser, license and regression risk before the existing editing workflow is improved.
3. Keep the current browser-first engine, add a focused editing-tools module, a compact timeline toolbar/history, project manifest recovery, and explicit export rescue actions. **Chosen** because it improves daily usability and memory safety while preserving the tested export pipeline and GitHub Pages static deployment.

## UX decisions
- Desktop keeps the left media/clip queue, center preview/timeline, and right inspector.
- The timeline gets Split, Duplicate, Move earlier/later, and Delete actions; keyboard shortcuts are optional only where safe.
- Undo/Redo are always visible in the top bar and disabled when their history stack is empty.
- Save project downloads JSON. Autosave stores only project settings, clip metadata and edit styles in localStorage, never the video file itself. Importing a project requires the user to reselect the source video.
- Export recovery offers: switch to Original stream, disable text burn-in/effects, and try a single selected clip. Large files will not silently be re-encoded after a stream-copy failure.
- Creator copy remains local-first. Any generated captions/hashtags are presented as suggestions, not claims about semantic video understanding.

## Constraints
- Static GitHub Pages app; no backend required.
- Keep dependencies free/open source and load optional heavyweight models only on demand.
- Use plain ES modules compatible with current browser support and Node's built-in test runner.
- Source video remains in the browser; only project metadata is exported or autosaved.
- Existing FFmpeg WASM limitations remain; surface those limitations clearly rather than claiming they are fully eliminated.

## Acceptance criteria
- Automated tests cover split boundaries, duplicate/order behavior, project-manifest validation, and existing creator-ideas checks.
- Undo/Redo, timeline actions, portable project save/import, and export recovery buttons are wired to the live app.
- Failed stream copy on a large source does not immediately force a memory-heavy transcode.
- Inline JavaScript syntax checks and the GitHub Actions smoke suite pass.
