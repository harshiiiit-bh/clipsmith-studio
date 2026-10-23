# ClipSmith Studio — Creator workspace

A browser-first video clipping studio for turning an authorised source video into a series of short clips with consistent part titles, styled text, captions and flexible exports.

## What changed in the creator workspace

- Fixed-height, three-column desktop editor: media/clip queue, preview/timeline, and a tabbed editing inspector.
- Compact mobile workspace with dedicated Media, Preview, Clips, Text and Export navigation rather than one endless page.
- Expanded heading typography: larger font library, case transforms, left/center/right alignment, letter spacing, line height, italics, outline/shadow controls, title backings, placement and reusable part numbering.
- Expanded caption styling: multiple font options, preset looks, text transforms, alignment, spacing, background, outline, shadow and vertical position.
- Shared title patterns across a series plus per-clip title/caption edits and multi-select style application.
- Clip queue with per-clip preview and separate-file export actions.
- Export selected clips as individual files or package the full batch as a ZIP.
- Custom-duration splitting, start/end range, aspect-format controls, SRT/VTT import and subtitle sidecars.
- Local-first workflow; source media is not uploaded to a ClipSmith backend.

## Run locally

Serve the folder over HTTP rather than opening the HTML as a `file://` URL:

```bash
python -m http.server 8000
```

Visit `http://localhost:8000`.

FFmpeg WebAssembly is loaded on demand from jsDelivr, so an internet connection is required for rendering. No backend or API key is required for this MVP.

## Publish on GitHub Pages

This repository is currently configured to publish from the `main` branch, root folder (`/`). The root `index.html` is the site entrypoint. Commits to `main` are published by GitHub Pages automatically after its build finishes.

## Quality and processing notes

- Original stream mode avoids video re-encoding, preserving the encoded streams, but cuts can align to nearby keyframes rather than exact frames.
- Precise cuts, aspect conversion and burned-in text require re-encoding and may change quality. The H.264 output uses a high-quality CRF setting, but it is not mathematically lossless.
- Video processing happens in browser memory. Very large files may exhaust memory on phones; test with a short clip first.
- Direct video URLs only work when the host exposes media directly and permits browser CORS access. YouTube links are preview-only; the app does not download or rip YouTube videos.
- Manual captions and SRT/VTT import are supported. Live speech-to-text and AI highlight detection are not included in this MVP.
- Use only videos and audio you own or are authorised to edit and redistribute.
