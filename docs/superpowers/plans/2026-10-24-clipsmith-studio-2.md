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
- [ ] Wire the smoke script into the existing `check:mobile` test chain and verify assertions after implementation.

### Task 2: Design layer

**Files:** Create `studio-2.css`.
**Interfaces:** Override styles only; consume the existing classes and IDs.

- [ ] Establish refined design tokens and legible control typography.
- [ ] Improve large desktop/laptop grid, preview stage, clip timeline, inspector, and focus states.
- [ ] Improve phone/tablet breakpoints without removing current controls.
- [ ] Respect reduced motion and safe-area insets.

### Task 3: Connect and verify

**Files:** Modify `index.html`, `package.json`.
- [ ] Load `studio-2.css` after the existing `styles.css` with cache-busting.
- [ ] Add responsive smoke script to the test chain.
- [ ] Review the final diff and test available checks.
