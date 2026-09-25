# Cardfile: Current Project State & Handoff

*Ephemeral whiteboard for AI agents. Update or replace this content at the end of each session.*

---

## Current Status

- **Version:** 0.3.0
- **Health:** Working. Bug-fix patch applied on 2026-09-25.
- **Most Recent Change:** Bug fix – restored missing `debouncedSave` in `pages/library.js` (was removed accidentally during auto-fill wiring, causing a silent ReferenceError that broke saving from Pronunciation/Meaning inputs). Switched primary translate client to `dict-chrome-ex` with `gtx` fallback in `core/app.js` to avoid 429 rate-limits blocking auto-fill. All features 1–6 remain intact.

---

## Fragile Areas (Touch with Care)

- `index.html`: Keep `var(--font-ui)` font family on `.fc-rom` / `.cell-rom` to avoid broken tone mark rendering on Windows.
- `index.html`: Viewport scroll prevention requires `overflow: hidden; height: 100vh;` on `body` and `.container`.
- `pages/library.js`: `isTableLocked` preserves locked scroll position after row deletions so UI doesn't jump.
- `pages/library.js`: The `createCardRow` function declares three debounced helpers in strict order – `debouncedSave` MUST come before `manuallyEditedBack/Rom` flags; `debouncedAutoFill` comes after. Do NOT rearrange.
- `index.html`: `.card-table th` requires `position: sticky; top: 0; z-index: 2` and `background: var(--surface-2)` to stay visible while rows scroll inside `.table-wrap`.
- `core/app.js`: In `parseTranslateResponse()`, segment index 2 is target transliteration; segment index 3 is source transliteration fallback. Do not invert.

---

## Current Task / Objective

- None active (session ended, all pending bugs fixed).

---

## Immediate Next Steps (Prioritized)

1. **Extract CSS:** Move the inline `<style>` block from `index.html` into a dedicated `styles.css` file (zero logic impact, purely organisational).
2. **Feature 7 (Optional):** Auto-fill on entry for *new* rows – when a user types the front word into a freshly appended empty row and pauses, auto-populate Pronunciation and Meaning via `app.autoFillFromFront()`. The mechanism already exists in `createCardRow`; this task is about wiring it consistently for newly appended rows vs. existing saved cards.

---

## Open Human Decisions

- Should future deck export format (v3) include learning progress, or remain content-only?
- Retain the unofficial Google Translate endpoint (`client=dict-chrome-ex` / `gtx`) or integrate a proper API key?

---

## Path Encoding Note (for AI agents)

The real filesystem path to this repo is NOT `c:\Users\Admin\OneDrive\Tài li?u\GitHub\flashcard`.
The Vietnamese folder name is encoded differently by Windows. To reliably locate the repo root in PowerShell, use:
```powershell
C:\Users\Admin\OneDrive\Ta`i liê?u\GitHub\flashcard = Get-ChildItem "C:\Users\Admin\OneDrive" -Recurse -Filter "STATE.md" | Select-Object -ExpandProperty DirectoryName | Select-Object -First 1
```
Always use `C:\Users\Admin\OneDrive\Ta`i liê?u\GitHub\flashcard` as the path prefix for all `git` and file operations in this repo.