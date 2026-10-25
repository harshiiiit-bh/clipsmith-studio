# ClipSmith Studio — Creator workspace

## Studio Max responsive UI

The Studio Max visual layer keeps the browser editor lightweight and framework-free while refining the desktop editing room, laptop-width control density, touch navigation, preview canvas, clip timeline, inspector sheet, focus states, and reduced-motion/accessibility behavior. The original video-processing engine and existing event-wired controls remain in place. No new runtime dependency is required.


A browser-first video clipping studio for turning an authorised source video into a short-form series with consistent part titles, styled captions, creator ideas and flexible exports.

## Editor workspace

- Fixed-height three-column desktop editor: media/clip queue, preview/timeline, and a tabbed inspector.
- Compact mobile workspace with dedicated Media, Preview, Clips, Text, Ideas and Export views. The old floating export bar is removed so it does not cover the queue.
- Expanded heading typography: **41 font families**, **30 one-tap title looks**, and 16 advanced controls for weight, letter case, alignment, decoration, outline thickness, shadow colour, glow, backing-panel colour/opacity/padding/roundness, rotation, line height and vertical placement. Native select menus use explicit dark-theme option colours for readable font names. The preset library also supports live search, category filters, persistent favourites and a one-click default-style reset. Selected presets are highlighted, and style cards are arranged to keep their labels and favourite controls separate.
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

## ZIP episode import and format recovery

- **ZIP episode browser:** choose a `.zip` archive from Add video or drag it into the editor. ClipSmith reads the archive's index, shows the video episodes with search and file sizes, and extracts **only the selected episode**. You do not need to unpack a season containing 100+ episodes first, and the archive is not uploaded.
- **Common video containers:** MP4, M4V, MOV, WebM, MKV, AVI, OGV/OGG, MPEG, TS/MTS/M2TS, FLV, WMV, 3GP, VOB and several other common containers can be imported by extension even if Windows or the browser reports a blank MIME type.
- **Decoder recovery:** if Chrome cannot decode the selected episode's container or codec, ClipSmith attempts a local FFmpeg.wasm H.264/AAC compatibility preview. The original selected episode remains the source for exports, so preview conversion does not replace the original with a lower-quality file.
- **Practical limits:** the app limits compatibility conversion to 1.75 GB per episode; real limits can be lower depending on browser/WebView memory. A large archive can contain many episodes, but select one at a time. ZIP is supported for archive browsing; convert RAR/7z/TAR archives to ZIP first. Non-video documents and password-protected ZIPs cannot be edited as video.

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
- Automatic subtitles use a local Whisper model in the browser when you request transcription. The first run may download model files; you can also import subtitles or paste a transcript/summary for creator ideas.
- Use only videos and audio you own or are authorised to edit and redistribute.


## Android APK

ClipSmith can be built as a native Android shell with its web editor packaged locally by Capacitor. The APK builder runs on pushes to `main` and publishes the latest downloadable `ClipSmith.apk` on the GitHub Release tagged `android-latest`.

- Website install button: `https://github.com/harshiiiit-bh/clipsmith-studio/releases/download/android-latest/ClipSmith.apk`
- Manual build on a machine with Node 22, Java 21 and Android SDK: `npm install`, `npm run prepare:mobile`, `npx cap add android`, `npx cap sync android`, `node scripts/patch-android.mjs`, then `cd android && ./gradlew assembleDebug`.
- Editor assets are bundled into the app. Video conversion and speech/object models are loaded only when used and may require an internet connection on first use.
- Memory-safe mode warns about source files/durations that may strain a phone, keeps exports serial, and releases temporary FFmpeg/AI runtimes after heavy tasks. The Memory Vault separately autosaves project state and remembers a source-video copy in IndexedDB when local storage permits it. If the media copy cannot be saved, re-import the video after reopening. Use Save to export an independent project backup for important work.
- The automated APK is debug-signed for direct testing/sideloading, not a Play Store release. Debug builds may require uninstalling an older build before installing a later build if their signing keys differ.


## Premium spacing and responsive layout

The latest visual layer standardises spacing across the header, tool rail, editing canvas, timeline, inspector, modals and mobile navigation. Responsive layouts reduce toolbar crowding, make actions wrap or collapse before colliding, increase panel breathing room, and use a seven-column mobile navigation so all destinations fit without an extra overflowing tab. Long inspector content scrolls inside its own panel rather than covering neighbouring work areas.


## ClipSmith brand identity

The header now uses a custom scalable SVG wordmark; the matching gradient play-frame mark is also the browser favicon. The brand finish stylesheet applies a consistent navy/violet/cyan visual system, refined surfaces and controls, improved hover and keyboard-focus states, and responsive logo sizing. The logo remains vector-based for crisp display across desktop and mobile resolutions.
