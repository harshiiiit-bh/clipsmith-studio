# ClipSmith Studio 2.0 Responsive Workspace Implementation Plan

> **For agentic workers:** Execute the tasks in order; preserve existing editor IDs and behaviors.

**Goal:** Upgrade ClipSmith's desktop/laptop workspace and mobile styling without replacing the editor engine.
**Architecture:** Add a versioned CSS override layer after the existing stylesheet, preserve the existing mobile drawer/navigation patterns, and add static responsive smoke checks.
**Tech Stack:** Existing HTML, CSS, vanilla JavaScript, and Node's built-in assertion APIs.
**Spec:** `docs/design/clipsmith-studio-2-spec.md`

## Global Constraints
- Preserve existing editor DOM IDs and event listeners.
- Do not add frontend framework or runtime dependencies.
- Keep client-side media handling and existing export logic unchanged.
- Do not write directly to `main`; stage changes on `feat/clipSmith-studio-2-responsive-workspace`.

## Review Focus
- A 1024px laptop viewport must keep the central preview usable with rail and inspector present.
- At 820px and below, the mobile bottom navigation and inspector drawer must still work.
- At 420px and below, the header/actions must not force page-wide horizontal scrolling.
- Keyboard users must retain visible focus.
- Reduced-motion users must not be forced to experience added UI transitions.

---

### Task 1: Responsive smoke checks

**Files:** Create `tests/ui-responsive-smoke.mjs`; modify `package.json`.
**Interfaces:** Test reads `index.html`, `studio-2.css`, and `package.json`.

- [x] Add assertions for stylesheet order, expected layout selectors, responsive breakpoints, safe areas, reduced motion, focus visibility, and no React dependency.
- [x] Wire the smoke script into the existing `check:mobile` test chain; verified by the passing GitHub smoke workflow and Android packaging test step.

### Task 2: Design layer

**Files:** Create `studio-2.css`.
**Interfaces:** Override styles only; consume the existing classes and IDs.

- [x] Establish refined design tokens and legible control typography.
- [x] Improve large desktop/laptop grid, preview stage, clip timeline, inspector, and focus states.
- [x] Improve phone/tablet breakpoints without removing current controls.
- [x] Respect reduced motion and safe-area insets.

### Task 3: Connect and verify

**Files:** Modify `index.html`, `package.json`.
- [x] Load `studio-2.css` after the existing `styles.css` with cache-busting.
- [x] Add responsive smoke script to the test chain.
- [x] Review the final diff and run the GitHub smoke workflow; the Android package checks and asset sync passed. Full Gradle APK build is a separate running check.

## Verification notes
- The first packaging regression test correctly failed because `scripts/prepare-mobile.mjs` did not copy the new CSS; the asset list was fixed and the check rerun successfully.
- `ClipSmith smoke checks` passed on the feature branch after the regression fix.
- Android WebView asset preparation and Capacitor sync passed; the Gradle APK build was still running at the time this plan was updated.
- A real browser visual check was not available in this session, so verify the actual rendered experience before merging.
