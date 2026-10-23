# ClipSmith Studio

A browser-first clipping studio for creators who need short, consistently titled video parts without uploading their footage to a ClipSmith server.

## Run locally

Because browser video APIs and WebAssembly workers have security requirements, serve this folder over HTTP rather than opening `index.html` as a `file://` URL. For example:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

The FFmpeg engine and supporting utilities are loaded on demand from jsDelivr, so an internet connection is required for rendering. No backend or API key is needed for the current MVP.

## Features in this version

- Import a local video by browse or drag-and-drop.
- Import a direct media URL when the host permits browser CORS access.
- Preview YouTube videos in an embed; YouTube watch links are not downloaded or ripped.
- Split the selected range into 15, 30, 45, 60 second, or custom-duration clips.
- Generate numbered Part, Episode, or Chapter headings, then override any clip title.
- Select clips and apply title/caption settings individually or as a batch.
- Preview heading and caption styles, with font, size, color, placement, weight, and background controls.
- Add manual captions or import SRT/VTT subtitles; export SRT sidecars with clips.
- Export multiple clips in a ZIP.
- Choose stream-copy mode for speed and no video re-encoding, or H.264 re-encoding for more precise cuts and overlays.
- Runs in the browser; the source file is not uploaded to a ClipSmith backend.

## Important limitations

- Browser processing keeps media in memory. Large videos may overwhelm a phone or a low-memory device; start with a short sample.
- Stream-copy mode preserves the original encoded streams, but cuts may align to nearby keyframes rather than exact frames.
- Precise cuts, aspect-ratio conversion, and burned-in text require re-encoding and can affect quality. The H.264 export uses a high-quality CRF setting, but it is not mathematically lossless.
- Burned-in text depends on the FFmpeg WebAssembly build supporting the required subtitle filter. If it fails, the editor attempts a safe stream-copy fallback and includes subtitle sidecars when available.
- Automatic speech-to-text captions and AI highlight detection are not part of this MVP.
- A remote media URL only works when the server serves media directly and allows cross-origin browser access. YouTube embeds are preview-only.
- Use only videos and audio that you own or are authorized to edit and redistribute.

## Deployment

The included GitHub Actions workflow publishes this static site to GitHub Pages when the workflow has Pages deployment permission. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the build/deployment source if GitHub Pages has not been enabled for the repo yet.

## Roadmap ideas

- Speech-to-text transcription with a local or opt-in remote engine.
- Scene detection and silence-based clip suggestions.
- 9:16 / 1:1 reframing and safe-area guides.
- Project saving and reusable title/caption presets.
- Undo/redo history and clip-level timeline trimming.
