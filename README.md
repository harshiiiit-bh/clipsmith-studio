# ClipSmith Studio — Creator workspace

A browser-first video clipping studio for turning an authorised source video into a short-form series with consistent part titles, styled captions, creator ideas and flexible exports.

## Editor workspace

- Fixed-height three-column desktop editor: media/clip queue, preview/timeline, and a tabbed inspector.
- Compact mobile workspace with dedicated Media, Preview, Clips, Text, Ideas and Export views. The old floating export bar is removed so it does not cover the queue.
- Expanded heading typography: a larger font library, case transforms, alignment, letter spacing, line height, italics, outline colour/thickness, shadow, backing, opacity, rotation and placement.
- Expanded captions: font presets, text transforms, alignment, spacing, colour, background, outline, shadow, opacity, karaoke highlight colour and fine vertical placement.
- Shared title patterns across a series, per-clip title/caption edits, selected-clip operations, grouping, preview and custom-duration splitting.
- FX / Audio inspector: brightness, contrast, saturation, soft focus, grayscale, speed, volume, mute and quick visual presets.
- Aspect/canvas formats, start/end range, SRT/VTT import and subtitle sidecars.
- Automatic selection starts with the first clip only; bulk actions require a deliberate selection.

## Creator Copilot — no paid API key

The **Ideas** tab generates eight caption hooks in Hinglish, Hindi or English, with Hype, Funny, Dramatic and Informative styles. Hashtags adapt to the selected platform and use the project title/filename, imported subtitles, clip captions and user-provided keywords.

Optional **Analyze frames** loads TensorFlow.js and the COCO-SSD object-detection model on demand, then samples three frames locally to detect common objects. It can add visual context to caption and hashtag suggestions. It does not understand full plot, dialogue, characters or emotions, so import SRT/VTT or paste a dialogue/summary for better relevance.

- [TensorFlow.js](https://www.tensorflow.org/js)
- [COCO-SSD model](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd)
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)

The creator caption generator is a lightweight in-browser template/rules engine, not a hosted LLM. Your video is not uploaded to a ClipSmith API.

## Export and phone-memory safeguards

- Individual export is the recommended path for large videos and series. Each clip is delivered as its own download and its in-memory output is released before the next clip is processed.
- ZIP is optional and limited to **8 clips per batch** and source files under **350 MB**.
- Source files above the app's conservative **1.75 GB** safety ceiling are rejected; even smaller files can run out of memory on low-RAM phones.
- Original stream mode is the fastest and avoids video re-encoding, but cuts can align to nearby keyframes. Precise cuts, aspect conversion, FX and burned-in text require re-encoding and may take much longer.
- Title burn-in is off by default to avoid forcing an expensive re-encode for every clip. Enable **Burn into export** when you specifically need the title baked into the pixels. Otherwise a title TXT sidecar accompanies each clip; manual/imported captions can be delivered as SRT sidecars.
- Export errors now show diagnostic details and a relevant recovery path in the Export view. If a browser asks, allow multiple downloads when exporting a large series.

FFmpeg.wasm documents a 2 GB input-file ceiling because of its WebAssembly memory limit; a phone may hit practical memory limits well before that. See the [official FAQ](https://ffmpegwasm.netlify.app/docs/faq/).

## Timeline editing and project recovery

- Select a clip and use **Split** at the preview playhead, **Duplicate**, **Earlier / Later**, or **Delete** to organize the sequence. Undo/redo is available in the top bar, including `Ctrl/Cmd + Z` and `Ctrl/Cmd + Shift + Z`.
- Drag the heading or caption directly on the preview to reposition it. Keyboard arrow keys can fine-tune the active overlay when it has focus.
- **Save** downloads a versioned `.json` project recipe; **Load** restores it. Local autosave keeps clip timing, names, styling and control values on the device. Project files and autosaves never contain the video itself. Re-select the same source file to preview/export a saved project; a mismatched filename, file size, or duration pauses exporting to avoid applying old edit points to the wrong video.
- Export errors reveal recovery options: switch to Original stream, disable burn-in/effects/crop, or retry a single clip. For larger or memory-sensitive sources, a failed stream copy no longer silently launches a full compatibility transcode. Converting the source to a smaller MP4 may still be required on low-memory phones.

## Run locally

Serve the folder over HTTP rather than opening the HTML as a file URL.

    python -m http.server 8000

Visit http://localhost:8000.

FFmpeg.wasm is loaded on demand from jsDelivr. The optional object detector downloads its model only when you press Analyze frames. An internet connection is needed for rendering and optional frame analysis, but there is no ClipSmith backend or API key.

## Publish on GitHub Pages

The repository publishes from the main branch, root folder (/). The root index.html is the entry point. Commits to main are published by GitHub Pages after the deployment workflow completes.

## Quality and processing notes

- Original stream mode preserves encoded streams when the codec/container combination is supported, but cuts may snap to keyframes and text/FX are not baked into video.
- The MP4 compatibility/re-encode path uses H.264 at a high-quality CRF setting, but it is not mathematically lossless.
- Direct video URLs need to allow browser CORS access. YouTube links remain preview-only; the studio does not download or rip videos from YouTube.
- Speech-to-text transcription is not built in. Import subtitles or paste a transcript/summary for more useful creator ideas.
- Use only videos and audio you own or are authorised to edit and redistribute.


## Android APK

ClipSmith Studio can be built as an Android app with Capacitor. The APK build runs automatically after changes land on `main` and is published to the stable [Android APK download](https://github.com/harshiiiit-bh/clipsmith-studio/releases/download/android-latest/ClipSmith-Android.apk).

For a local build, install Node.js 22+, Java 21, and the Android SDK, then run:

```sh
npm install
npm run android:init
cd android
./gradlew assembleDebug
```

The app includes a local memory vault: project edits and settings autosave on-device, and the current source video is saved to IndexedDB when storage permits so the draft can reconnect after restart. Use **Save** to export a portable project file as an additional backup. Clearing app data or uninstalling the app removes local memory.

The direct-download APK is debug-signed for sideloading, not for Play Store distribution. The app uses browser-based media tools and first-time speech-recognition model downloads may require internet and free storage.
