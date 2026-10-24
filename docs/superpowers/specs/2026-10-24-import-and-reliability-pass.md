# ClipSmith Import & Reliability Pass

## Goal
Make the first editing session understandable, keep editor state consistent, and make export failures more recoverable.

## User-facing behavior
- Importing a playable local video automatically creates a bounded clip plan using the selected duration (30 seconds by default).
- The preview empty state includes a primary import action.
- Direct video links can be imported when the hosting server allows CORS. They are downloaded to the browser, limited to 300 MB, and validated for basic errors such as a webpage response.
- Saved projects explain that their source video must be re-imported/relinked after reload; opening a new project cannot accidentally keep the previously open source attached.
- Undo/Redo stores the previous editor snapshot. Title, caption and FX changes are saved, and visual/audio FX are reflected in the preview where browser playback supports them.
- Smart export tries stream-copy for unfiltered cuts, then retries as a compatible MP4 encode after a stream-copy error. Explicit Original Stream mode tells the user when it cannot apply encoding-based effects.
- Optional on-demand frame analysis detects visible objects locally and can enrich caption/hashtag ideas. It does not claim to understand dialogue or the story; users can provide a transcript or description.

## Constraints
- Static GitHub Pages deployment; source video is not uploaded.
- Direct URL import requires CORS and has a 300 MB cap.
- Automatic clip plans are capped at 5,000 segments.
- Optional vision scripts/models are fetched only after the user requests frame analysis.
- No claim of universal codec support or zero bugs on every mobile browser.

## Non-goals
- Automatic speech transcription, cloud AI inference, a native mobile codec pipeline, or a promise to support every container/codec.
