# Cardfile: Agent Architecture & Rules

Permanent rules, boundaries, and invariants for AI agents working in this repository.
Read this document before making any changes.

---

## 1. Runtime & Constraints

- **Zero-build environment:** Plain HTML5, ES6/vanilla JavaScript (IIFEs), and vanilla CSS. No Node/npm dependencies, no bundler, no framework, no external libraries.
- **Persistence:** Client-side browser `localStorage` only (no backend API, ~5 MB quota limit).
- **Script loading order:** Classic `defer` scripts share one global scope. The order in `index.html` is mandatory:
  ```
  utils/helpers.js → services/storage.js → services/deck-portability.js → core/scheduler.js
  → ui.js → pages/home.js → pages/library.js → components/deck-manager.js
  → components/card-modal.js → components/import-modal.js → pages/review.js
  → core/app.js (LAST: calls app.init())
  ```
  New modules or renderers must be placed before `core/app.js`.

---

## 2. Architecture & State Boundaries

- **Call hierarchy:**
  ```
  pages/* & components/*  ──►  ui.js (generic helpers: h, modal, toast)
        │
        ▼
     core/app.js          ──►  core/scheduler.js (pure SM-2 logic)
        │                 ──►  services/deck-portability.js
        ▼
   services/storage.js    ──►  localStorage (THE ONLY module accessing storage)
  ```
- **UI never calls `storage.*` directly:** UI pages and components only invoke `app.*` methods.
- **Mutation flow:** `app.*` mutates via `storage.*`, then terminates in `app.commit()` (`storage.persist()` → `syncActiveDeck()` → `ui.render()`).
- **Pure scheduler:** `core/scheduler.js` receives progress objects and returns new progress objects. It never reads cards, decks, or the DOM.

---

## 3. Data Safety & Storage Separation

- **Storage keys:**
  - `vocab_library`: `{ decks: [...], cards: { [id]: {...} } }` (content only).
  - `vocab_progress`: `{ [cardId]: { state, step, easeFactor, interval, ... } }` (SM-2 only).
  - `vocab_meta`: `{ lastOpened: { [deckId]: timestamp } }`.
- **Strict decoupling:** Content and learning progress must remain strictly separated. Never store front/back/language in `vocab_progress` or schedule data in `vocab_library`.
- **Backward compatibility & migrations:**
  - `storage.sanitizeLibrary()` repairs orphan cards, verifies deck-card relationships, and migrates legacy schemas on startup.
  - Existing user data must always load. Unparseable JSON is safely backed up to `<key>_corrupt_<timestamp>` before initializing empty state.

---

## 4. Hard Invariants (Do Not Break)

1. **DOM construction:** Build elements using `ui.h()`. NEVER use `innerHTML` with external, imported, or user-supplied data.
2. **`replaceChildren()` pitfall:** Never pass `null` or `undefined` to `replaceChildren()`. The browser stringifies them to the literal text `"null"`.
3. **Modal element timing:** Form inputs and helper containers inside `<dialog id="modal">` (such as `#auto-fill-note`) do not exist in document DOM until after `ui.openModal()` is executed.
4. **Back-field split:** Card back contains two distinct sub-fields: meaning (`card.back`) and pronunciation (`card.romanization`).
   - On individual card save (`card-modal.js`), `romanization` is preserved and never cleared based on language.
   - Note: Switching a deck's target language to a non-romanized language in `app.updateDeckLanguage` intentionally purges stale romanizations.
5. **Timestamps & due dates:** Timestamps are ms epochs. Review card due dates use local calendar midnight via `utils.addDaysToToday()`. Do not use raw millisecond additions (`+ 86400000`) which drift across DST boundaries.
6. **Property assignment in `ui.h()`:** Sets DOM properties when they exist on the element. For boolean string attributes like `spellcheck="false"`, set via `el.setAttribute('spellcheck', 'false')`.

---

## 5. Permanent Gotchas

- **Pronunciation typography:** Always style `.fc-rom` and `.cell-rom` using `var(--font-ui)` (system sans-serif / Segoe UI) with weight 500. Windows system serif fonts lack OpenType accent-positioning tables in italic, causing detached/floating tone marks (e.g. `\u01d0`).
- **Array reference stability:** `storage.deleteDeck()` reassigns `library.decks` to a new array. Never hold or cache stale references to `library.decks`.
- **Multi-tab concurrency:** Tabs maintain separate in-memory caches. There is currently no `storage` event listener; last write wins.
