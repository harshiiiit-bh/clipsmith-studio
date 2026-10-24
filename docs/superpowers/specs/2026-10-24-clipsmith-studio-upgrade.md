# ClipSmith Studio — Creator Editor Upgrade

## Goal
Turn ClipSmith from a stacked clipping form into a compact, professional browser editor that is fast on mobile, privacy-first, and resilient when exporting large videos.

## Product decisions
- **Editor model:** fixed workspace: top bar, tool rail, preview, contextual inspector, compact timeline/clip strip.
- **Privacy:** local-first. Media stays in the browser; no mandatory upload or account.
- **Processing:** use native browser capabilities when available for preview/export and keep FFmpeg WASM as the compatibility/fallback path. ffmpeg.wasm is MIT and explicitly designed for browser-side media processing. 
- **Large exports:** queue one clip at a time, release output blobs immediately after download, avoid retaining every encoded result in memory, and expose recovery presets instead of a generic failure toast.
- **Creator intelligence:** local heuristics from project metadata, title/caption text, and optional transcript input. Never claim video semantics that were not actually analyzed.
- **Mobile:** no page-length clip-card wall. Use drawers/sheets for tools and a horizontally scrollable compact clip strip.

## Editor layout
1. Top bar: project name, undo/redo, autosave state, export.
2. Left rail: Media, Cut, Text, Captions, FX, Audio, Creator.
3. Center: preview canvas with safe zones, ratio controls, title/caption overlays.
4. Right inspector: only the controls relevant to the active tool/selection.
5. Bottom timeline: playhead, clip blocks, split/delete/duplicate, zoom, selection.
6. Mobile: bottom tool rail + full-screen inspector sheets; preview remains dominant.

## Core features
- Upload local video and load supported direct media URLs where browser policy permits.
- Clip duration presets and custom duration.
- Split at playhead, trim, duplicate, reorder, delete, multi-select.
- Series title with automatic Part N naming.
- Text styling with font, size, weight, color, outline, opacity, rotation and placement.
- Caption styling with karaoke highlight, outline, opacity and placement.
- Crop/ratio presets: 16:9, 9:16, 1:1, 4:5.
- FX/audio: brightness, contrast, saturation, blur, grayscale, speed, volume, mute and presets.
- Autosave/recovery via localStorage/IndexedDB-compatible project state.
- Export queue with individual download, selected download and optional ZIP.
- Export fallback ladder: original stream → lower-resolution re-encode → lower-quality re-encode, with clear diagnostics.
- Creator panel: caption ideas, hooks, titles, descriptions, CTAs, keywords and hashtags with platform/tone presets.

## Non-goals for this iteration
- Server-side rendering.
- Paid third-party AI dependency.
- Pretending to infer semantic content from raw pixels without transcript/analysis support.

## Acceptance bar
The new UI must fit in one viewport on desktop and remain usable on a phone without a giant vertical list. Export failure must produce an actionable recovery state. Creator suggestions must be clearly labeled as generated from available project text/metadata. Existing clip/title/caption/effect behavior must remain functional.
