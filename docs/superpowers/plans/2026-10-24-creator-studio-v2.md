# ClipSmith Creator Studio v2 Implementation Plan

> **Execution:** Native implementation in the existing GitHub repository, with CI smoke checks and a fresh post-merge verification.

**Goal:** Make ClipSmith feel like a responsive, modern creator studio with locally generated subtitles, editable on-canvas titles, safer clip ordering, and ten practical creator improvements.

**Architecture:** Keep the app static and browser-first. Lazy-load the Whisper ASR model only when the user requests transcription; extract audio into short WAV segments with the existing FFmpeg WASM runtime and send samples to a module worker so model inference is off the UI thread. Keep subtitles and timeline helpers pure and testable. Use free Google Fonts (Bricolage Grotesque for display, Inter for interface text) and keep export options explicit rather than silently degrading the source.

**Tech Stack:** HTML/CSS/JavaScript modules; existing FFmpeg WASM; Hugging Face Transformers.js + a quantized Whisper model loaded on demand; GitHub Pages; Node smoke tests.

**Scope:**
- Automatic speech-to-text, timecoded subtitle cues, preview overlay, cue editing, and SRT download.
- Renumber auto-generated part titles whenever clips are removed, reordered, inserted, or duplicated; preserve manually customized titles.
- Edit heading text directly on the video canvas and resize it from quick canvas controls.
- Add ten further practical tools: scene-cut suggestions; PNG thumbnail export; drag-to-reorder; brand title presets; apply title/caption style to every clip; export aspect/platform presets; set trim in/out from playhead; nudge trims precisely; keyboard shortcut guide; and subtitle cue copy/edit controls.
- Upgrade visual design using an open font pairing and stronger studio layout, while preserving mobile support and lazy loading.
- Add regression tests for subtitle helpers, renumbering after removal, worker wiring, direct canvas editing, and the new creator controls.

## Global Constraints
- No external AI service receives user video/audio; transcription is performed in the browser after the model is fetched.
- The ASR model is loaded only after the user clicks Generate Auto Subtitles.
- Process audio in short chunks and surface progress/cancellation rather than blocking the whole interface.
- No claim of perfect transcription, scene detection, or zero browser bugs.
- Preserve existing project data and fallback behavior.

## Tasks
1. Add failing smoke assertions and pure helper tests for renumber-after-delete, subtitle cue grouping, SRT formatting, WAV decoding, and scene-suggestion ranking.
2. Implement/test helpers; update clip-delete/move/split flows to refresh automatic part labels while preserving explicit custom titles.
3. Implement lazy module-worker transcription, audio chunk extraction, subtitle preview/editing, SRT download, and cancellation/error feedback.
4. Add direct title editing/resizing and quick canvas controls; add clip reorder, thumbnail export, brand presets, bulk style application, ratio-aware export, playhead trim shortcuts, scene-cut suggestions, and keyboard help.
5. Apply visual system refresh and font pairing, with responsive layout and clear on-device processing states.
6. Run syntax and full smoke workflows, inspect CI logs, fix failures, merge only on green, then verify merged source and deployment status.

## Review Focus
- Long/large videos must not start model download or transcription without an explicit click.
- Audio extraction with missing audio or unsupported codecs must fail with a clear message and clean temporary FFmpeg files.
- Missing timestamps and overlapping scene suggestions must be bounded and not crash cue rendering.
- Deleting or moving one clip must renumber only auto-generated headings, not custom titles.
- Direct editing must not accidentally drag the overlay or treat control labels as part of the title.
- Mobile bottom navigation and drawers must remain usable at narrow widths.
