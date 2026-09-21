# Cardfile: Current Project State & Handoff

*Ephemeral whiteboard for AI agents. Update or replace this content at the end of each session.*

---

## Current Status

- **Version:** 0.2.1
- **Health:** Working. All views render properly in Chromium; Pinyin tone marks align cleanly; deck language swapping purges stale romanization.
- **Most Recent Change:** [0.2.1] - Styled `.fc-rom` and `.cell-rom` with `var(--font-ui)` to fix floating tone marks; sanitized stale romanizations on deck language switches.

---

## Fragile Areas (Touch with Care)

- `index.html`: Keep `var(--font-ui)` font family on `.fc-rom` / `.cell-rom` to avoid broken tone mark rendering on Windows.
- `core/app.js`: In `parseTranslateResponse()`, segment index 2 is target transliteration; segment index 3 is source transliteration fallback. Do not invert.

---

## Current Task / Objective

- None active (Documentation migration completed; ready for next roadmap item).

---

## Immediate Next Steps (Prioritized)

1. Verify auto-translate against the live Google Translate endpoint in a live browser.
2. Extract the inline `<style>` block from `index.html` into `styles.css` (zero logic impact).
3. Implement inline multi-row card addition in the library view.

---

## Open Human Decisions

- Should future deck export format (v3) include learning progress, or remain content-only?
- Retain the unofficial Google Translate endpoint (`client=gtx`) or integrate an API key?
