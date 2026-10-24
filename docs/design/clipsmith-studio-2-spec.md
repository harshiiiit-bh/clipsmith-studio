# ClipSmith Studio 2.0 — Responsive Workspace Specification

## Goal
Give ClipSmith Studio a more polished, legible, laptop-first editing workspace while improving—not replacing—the current mobile editor.

## Audience and use
Solo creators using browser-based editing on small laptops, standard 13–16 inch laptops, large desktop monitors, and phones. Video processing remains client-side and existing editing controls keep their current IDs and event wiring.

## Design direction
- Keep the current dark visual identity, but use clearer hierarchy, more breathing room, higher contrast, and restrained violet/mint accents.
- On laptop and desktop, treat the editor as a stable workspace: compact top bar, persistent tool rail, dominant preview, dedicated timeline area, and a legible inspector.
- Adapt spacing and panel widths for 1440px, 1280px, 1100px, and narrow laptop/split-screen widths without hiding core actions unnecessarily.
- Keep the existing mobile bottom navigation and inspector drawer model, with larger type, better active states, safer bottom insets, and reduced crowding.
- Preserve editor DOM IDs and all existing scripts. Add a stylesheet layer rather than replacing the existing 41KB stylesheet or moving editor logic.
- Respect keyboard focus, reduced-motion settings, safe-area insets, and narrow/short viewport heights.

## Non-goals
- No video-engine rewrite, dependency migration, React conversion, new cloud upload, or paid service.
- No claims of true multi-track editing unless the engine already supports it.
- No destructive changes to the current main branch.

## Acceptance criteria
1. Existing stylesheet and app script remain linked and existing editor DOM remains intact.
2. New responsive stylesheet is loaded after the existing stylesheet.
3. Laptop layouts maintain usable preview, timeline, and inspector panes without accidental horizontal page overflow.
4. Phone layouts retain the current bottom-nav/inspector-drawer interaction.
5. Controls and inspector text are more legible and keyboard focus is visibly styled.
6. Responsive smoke test passes; no new runtime dependencies.
