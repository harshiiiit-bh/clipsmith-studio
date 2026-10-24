# AI Creator Copilot — Implementation Plan

## Goal
Make the existing creator pane more intelligent with transcript-grounded editing suggestions that are useful even without paid APIs or a network AI key.

## Design
- Add a pure `ai-creator-tools.js` module, clearly labeling its transcript analysis as local heuristic assistance rather than promising a generative model that is not present.
- Score subtitle cues for strong hooks and rank short highlight windows, using timestamps already produced by on-device Whisper.
- Flag filler words, repeated phrases, long pauses, and captions that may be too long to read.
- Offer conservative subtitle cleanup with before/after review; do not silently delete spoken content.
- Build a short highlight reel from selected suggestions only after user confirmation.
- Generate transcript-grounded hook suggestions, chapter labels and platform readiness notes using the existing content pack engine.
- Preserve project state and keep expensive model inference opt-in.

## New Creator Features
1. Transcript-aware highlight finder and suggested clip windows.
2. Filler-word / repetition audit.
3. Long-pause finder with an action to add selected pauses to promo/skip ranges.
4. Safe subtitle cleanup suggestions.
5. Auto chapter/segment labels from transcript cues.
6. Hook lines extracted from the strongest moments.
7. Highlight reel builder using selected candidate windows.
8. Reading-speed and overlong-cue warnings.
9. Platform readiness score with actionable reasons.
10. One-click export of a creator brief (summary, hooks, tags, chapters, candidate timestamps).

## Files
- `ai-creator-tools.js`: pure algorithms for ranking highlights, transcript audits, cleanup suggestions, chapter labels, reading load and readiness.
- `index.html`: compact AI Creator Copilot panel and results.
- `app.js`: user-triggered analysis, review actions, selected highlight reel creation, creator brief download.
- `styles.css`: responsive feature cards and recommendation rows.
- `tests/smoke.mjs`: regression tests for ranking, auditing, cleanup, chapter generation, and the new UI wiring.

## Constraints
- No subtitle text or video is sent to a remote inference endpoint by these features.
- The current speech-to-text path stays lazy-loaded; AI Copilot runs only when requested.
- Do not promise automatic viral prediction; scores are transparent heuristics based on language cues and subtitle timing.
- Keep manual edits reversible through the existing undo history and avoid silently replacing the clip plan.

## Verification
Add tests before production code; run syntax and smoke suites, inspect workflow logs, review the diff, and merge only when CI is green.