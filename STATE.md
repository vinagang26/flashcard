# Cardfile: Current Project State & Handoff

*Ephemeral whiteboard for AI agents. Update or replace this content at the end of each session.*

---

## Current Status

- **Version:** 0.2.2
- **Health:** Working. Card table scrolls internally with a fixed max-height (480px) and sticky headers; action bar is pinned outside/below the scroll container.
- **Most Recent Change:** [0.2.2] - Implemented independently scrollable row list (`.table-wrap` fixed max-height + `overflow-y: auto`), sticky column headers (`.card-table th`), and pinned action bar outside/below the list (`.action-bar` with `position: sticky; bottom: 0`).

---

## Fragile Areas (Touch with Care)

- `index.html`: Keep `var(--font-ui)` font family on `.fc-rom` / `.cell-rom` to avoid broken tone mark rendering on Windows.
- `index.html`: Pinned `.action-bar` requires opaque `background: var(--bg)` and `z-index: 10` so content scrolling underneath does not bleed through.
- `index.html`: `.card-table th` requires `position: sticky; top: 0; z-index: 2` and `background: var(--surface-2)` to stay visible while rows scroll inside `.table-wrap`.
- `core/app.js`: In `parseTranslateResponse()`, segment index 2 is target transliteration; segment index 3 is source transliteration fallback. Do not invert.

---

## Current Task / Objective

- None active (Completed feature: independently scrollable row list with pinned action bar).

---

## Immediate Next Steps (Prioritized)

1. Implement inline multi-row card addition in the library view.
2. Implement per-row delete via kebab menu.
3. Verify auto-translate against the live Google Translate endpoint in a live browser.
4. Extract the inline `<style>` block from `index.html` into `styles.css` (zero logic impact).

---

## Open Human Decisions

- Should future deck export format (v3) include learning progress, or remain content-only?
- Retain the unofficial Google Translate endpoint (`client=gtx`) or integrate an API key?
