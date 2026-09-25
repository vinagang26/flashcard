# Cardfile: Current Project State & Handoff

*Ephemeral whiteboard for AI agents. Update or replace this content at the end of each session.*

---

## Current Status

- **Version:** 0.3.0
- **Health:** Working. Main deck view reordered with top row actions, viewport scrolling strictly prevented, inline multi-row card additions with editable inputs, lock-and-scroll threshold for table and centered + New Card button, per-row delete via kebab menu, and distinct split back-fields (Pronunciation & Meaning).
- **Most Recent Change:** [0.3.0] - Features 1–6 implemented: layout reorder, fix whole-page scrolling, inline multi-row addition, growing list then lock-and-scroll, per-row kebab delete, back field split.

---

## Fragile Areas (Touch with Care)

- `index.html`: Keep `var(--font-ui)` font family on `.fc-rom` / `.cell-rom` to avoid broken tone mark rendering on Windows.
- `index.html`: Viewport scroll prevention requires `overflow: hidden; height: 100vh;` on `body` and `.container`.
- `pages/library.js`: `isTableLocked` preserves the locked scroll position after row deletions so the UI doesn't jump.
- `index.html`: `.card-table th` requires `position: sticky; top: 0; z-index: 2` and `background: var(--surface-2)` to stay visible while rows scroll inside `.table-wrap`.
- `core/app.js`: In `parseTranslateResponse()`, segment index 2 is target transliteration; segment index 3 is source transliteration fallback. Do not invert.

---

## Current Task / Objective

- None active (Completed features 1 through 6).

---

## Immediate Next Steps (Prioritized)

1. Optional Phase 2: auto-fill on entry when typing the front word into a new row (Feature 7).
2. Extract the inline `<style>` block from `index.html` into `styles.css` (zero logic impact).

---

## Open Human Decisions

- Should future deck export format (v3) include learning progress, or remain content-only?
- Retain the unofficial Google Translate endpoint (`client=gtx`) or integrate an API key?
