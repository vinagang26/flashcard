# Cardfile: Architecture

Multilingual vocabulary flashcards with spaced repetition. Plain HTML, vanilla JS, vanilla CSS.
No build step, no framework, no external JS libraries, no backend. All data lives in the browser's `localStorage`.

> **For agents picking this up:** read this file first, then the newest entry in `changelog.md`
> (its **Handoff** block says what state the code is in and what to do next). Keep both files
> up to date when you change anything. Rules for that are at the top of `changelog.md`.

---

## 1. Running it

```
python3 -m http.server 8000      # from this folder, then open http://localhost:8000
```

Opening `index.html` directly from disk (`file://`) also works. Two things differ there: `crypto.randomUUID`
is unavailable, so `utils.generateId()` falls back to a timestamp + random id, and some browsers
partition `localStorage` per file path.

There is nothing to install or compile. To test, load the page in a browser; translation needs internet access.

---

## 2. File map

```
index.html                  Shell: <style> (all CSS), 3 screen containers, <dialog>, toast, <script defer> tags
ui.js                       Global `ui`: DOM helper h(), screen switching, modal, confirm, toast, language-pair widget
utils/helpers.js            Global `utils`: language list, romanization rules, ids, dates, validation, text folding
services/storage.js         Global `storage`: the ONLY module that touches localStorage
services/deck-portability.js  `window.deckPortability`: export / import / conflict analysis
core/scheduler.js           Global `scheduler`: SM-2 + learning steps. Pure logic, knows nothing about content or DOM
core/app.js                 Global `app`: navigation, review session, mutations, auto-translate. Calls app.init() last
pages/home.js               ui.renderHome
pages/library.js            ui.renderLibrary
pages/review.js             ui.renderReview + review keyboard shortcuts
components/deck-manager.js  ui.showDeckModal
components/card-modal.js    ui.showCardModal (auto-translate wiring lives here)
components/import-modal.js  ui.showImportConflictModal
```

### Load order (mandatory; classic `defer` scripts share one global scope)

```
helpers → storage → deck-portability → scheduler → ui → home → library
→ deck-manager → card-modal → import-modal → review → app (LAST)
```

`app.js` ends with `app.init()`. Everything it needs must already exist. Pages and components attach
their renderers to the `ui` object (`ui.renderHome = …`), which is why `ui.js` loads before them.
There are no ES modules; modules are `const x = (() => {…})()` IIFEs, except `deckPortability`, which is
assigned to `window`.

---

## 3. Layers and who may call whom

```
   pages/*  components/*        render DOM, call app.* for every action
        │
       ui.js                     generic UI plumbing (no app data logic)
        │
      app.js  ──────────────►  scheduler   (pure: progress in → progress out)
        │      └──────────────►  deckPortability ─┐
        ▼                                          ▼
     storage.js  ◄─────────────────────────────────┘   the only localStorage code
        │
     utils/helpers.js            used by everyone; depends on nothing
```

Rules that keep this clean:

- UI code never writes to `storage` directly. It calls an `app.*` method.
- `app.*` mutates through `storage.*`, then calls `app.commit()` (persist + re-render).
- `scheduler` receives and returns plain progress objects. It never reads the library.
- `deckPortability` mutates through `storage.*` inside `storage.batch()`.

---

## 4. Data model

Three localStorage keys. Content and progress are deliberately separate.

### `vocab_library`: content

```js
{
  decks: [{
    id, name, description, author,
    sourceLang, targetLang,        // Google Translate codes, e.g. 'zh-CN', 'en', 'vi'
    cardIds: [id, …]               // insertion order (library shows newest first)
  }],
  cards: {
    [id]: { id, deckId, front, romanization, back, exampleSentence }
  }
}
```

- `front` is in the deck's `sourceLang`, `back` in its `targetLang`.
- `romanization` is always a string. It is `''` unless the source language needs one.
  Needing one = `utils.needsRomanization()`: `zh-CN zh-TW ja ko ar hi th`.
- `sourceLang`/`targetLang` live on the **deck**, not the card. Changing them in the library bar
  changes labels and translation direction for the whole deck immediately.

### `vocab_progress`: SM-2 state, keyed by card id

```js
{ [cardId]: {
    state,            // 'new' | 'learning' | 'review' | 'relearning'
    step,             // index into the current learning steps
    easeFactor,       // starts 2.5, floor 1.3
    interval,         // days (review cards)
    repetition, lapses, reviewCount,
    nextReviewAt,     // ms epoch. Minute-precise while learning; local midnight for review cards
    lastReviewedAt    // ms epoch | null
} }
```

A card with **no entry** is `new`. Progress contains no language or content fields, so the scheduler is language-agnostic.

### `vocab_meta`

```js
{ lastOpened: { [deckId]: ms } }     // used only to sort the home screen
```

### Integrity behaviour (`storage.js`)

- On load, `sanitizeLibrary` repairs mismatches between `deck.cardIds` and `card.deckId`, drops orphan cards, and
  **migrates the original app's schema** (`hanzi/pinyin/meaning`, deck `language` → `zh-CN` → `en`).
- Unparseable JSON is copied to `<key>_corrupt_<timestamp>` before the app starts empty. Nothing is silently destroyed.
- A failed write (quota, blocked storage) calls the handler set by `storage.onError`, which shows an error toast.

---

## 5. Module reference

### `storage` (services/storage.js)

Keeps parsed data in memory and writes through on every mutation. `batch(fn)` defers the write until `fn` returns
(used by import so 1,000 cards means one write).

`init, persist, batch, getLibrary, getProgress, getDeck, getCard, getCardProgress, saveDeck, deleteDeck,
saveCard, deleteCard, saveCardProgress, recordDeckOpen, getLastOpened, onError`

- `saveDeck` / `saveCard` are create-or-update. Passing an existing id updates; passing an unknown id creates with that id (used by import).
- `saveCard(data, deckId)` with a different `deckId` **moves** the card and keeps its progress.
- `deleteDeck` / `deleteCard` also delete the related progress.
- **Reference stability:** `getLibrary()` and `getProgress()` return the same objects for the life of the page, **but**
  `deleteDeck` reassigns `library.decks` to a new array. Never cache `library.decks` across a mutation. Re-read it.

### `app` (core/app.js)

State: `screen`, `activeDeck`, `session`, `pendingImport`, `_autoFill`.

| Area | Methods |
|---|---|
| Lifecycle | `init`, `commit`, `showScreen`, `syncActiveDeck`, `getActiveDeck` |
| Decks | `getSortedDecks`, `openDeck`, `recordDeckOpen`, `saveDeck`, `deleteDeck`, `updateDeckLanguage`, `swapDeckLanguages` |
| Cards | `openCardModal`, `saveCard`, `deleteCard` |
| Queries | `getCombinedCards`, `getDueCards(deckId?)`, `getDeckStats(deckId)` |
| Review | `startReview`, `currentCard`, `getCardProgress`, `refreshReview`, `revealCard`, `submitRating`, `goHome`, `exitReview` |
| Portability | `exportDeckById`, `importDeck`, `handleImportResolution` |
| Translate | `triggerAutoFill`, `cancelAutoFill`, `autoFillFromFront`, `parseTranslateResponse` |

`commit()` = `storage.persist()` → `syncActiveDeck()` → `ui.render()`. Every mutation ends with it.
Rendering is **full re-render of the visible screen** (simple, fast enough for this data size).
The one exception is the library card list, which re-renders alone while typing in search so the input keeps focus.

### `ui` (ui.js)

- `ui.h(tag, props, ...children)`: hyperscript. Sets `textContent`, **never `innerHTML`**, so imported deck text cannot inject markup.
  Props: `class`, `style`, `for`, `onClick`-style handlers (`on` + event name), DOM properties when the element has them,
  otherwise attributes (anything containing `-`, like `aria-*` / `data-*`, is always an attribute). `null`/`false` props and children are skipped.
- `showScreen`, `render` (dispatches to `renderHome` / `renderLibrary` / `app.refreshReview`).
- Modal: a single native `<dialog id="modal">`. `openModal(node)`, `closeModal()`, `confirm({title,message,confirmLabel,danger})` → `Promise<boolean>`.
  Esc, backdrop click (press and release both on the backdrop) and Cancel all close it.
- `toast(msg, kind)`: uses the Popover API so it renders above an open modal; falls back to a fixed div.
- `buildLanguagePair({source,target,idPrefix,onSourceChange,onTargetChange,onSwap})` returns `{el, sourceSelect, targetSelect, getValue}`.
  Used by the library bar (persists on every change) and the deck modal (only read on Save).
- `showAutoFillLoading`, `setAutoFillNote`, `cardModalContext`: the card modal ↔ auto-translate hand-off.

### `scheduler` (core/scheduler.js)

Anki-style SM-2. All tunables are in `scheduler.CONFIG`.

| Situation | Again | Hard | Good | Easy |
|---|---|---|---|---|
| **New / learning** (steps 1m, 10m) | back to step 1 (1m) | repeat step (6m on step 1) | next step; last step → **review, 1 day** | **review, 4 days** |
| **Review** | **relearning** (10m), lapses+1, ease −0.20, interval 1 | ×1.2, ease −0.15 | ×ease | ×ease×1.3, ease +0.15 |
| **Relearning** (step 10m) | restart step | repeat step | → review, interval kept (min 1) | → review, interval+1 |

- `Hard < Good < Easy` is enforced to be strictly increasing even at tiny intervals.
- Review due dates are local midnight + N days (calendar arithmetic, DST-safe). Learning steps are exact timestamps.
- `processReview(progress, rating, now?)` returns a **new** object. `getIntervalPreviews(progress)` powers the button labels
  (`<1m`, `6m`, `10m`, `4d`, `1.1mo`, `2.7y`).
- `isDue(progress)`: no progress or `state==='new'` → due; else `nextReviewAt <= now`.

### `deckPortability` (services/deck-portability.js)

Export format (version 2), content only, **no progress**:

```json
{ "type": "vocab-deck-export", "formatVersion": 2, "exportedAt": 0,
  "deck": { "id": "", "name": "", "author": "", "description": "", "sourceLang": "", "targetLang": "",
            "cards": [{ "id": "", "front": "", "romanization": "", "back": "", "exampleSentence": "" }] } }
```

Import pipeline: `readFile` (10 MB cap) → `parseImport` (validates; **version 1 files are converted**; cards missing front or back are skipped and counted)
→ `analyzeImport` (conflict = same deck id, else same name, case-insensitive) → `applyImport(incoming, mode, existingDeckId)`.

| Mode | Behaviour |
|---|---|
| `new` | No conflict. Create deck; reuse ids unless already taken |
| `merge` | Keep everything; add only cards not already present |
| `update` | Overwrite matching cards and deck details; add the rest; keep unmatched existing cards; progress kept |
| `replace` | Delete existing deck (cards **and progress**), import fresh |
| `cancel` | Nothing |

Cards match on id first, then normalised `front` text. A card id already owned by another deck is regenerated.

---

## 6. Key flows

### Review session

`app.startReview({deckId, practice, cardIds})` builds `session = {deckId, practice, queue[], total, seen, reviewed, revealed, temp}`.

- **Normal:** `queue` = due cards, ordered learning/relearning → review → new (then by due time). Ratings are saved via `storage.saveCardProgress`.
- **Practice** (`practice:true`, or `cardIds`): all cards shuffled; progress is computed in `session.temp` and **never saved**. Buttons show no interval previews.
- `deckId: null` = all decks combined. Each card's language labels come from **its own deck**.
- **Re-queue rule:** after a rating, if the card is still `learning`/`relearning`, it re-enters the queue: Again/Hard after ≤4 cards,
  a passed non-final step at the end. This ignores the real due time (a 10-minute step can reappear seconds later if the queue is short).
- The session ends when the queue is empty: "Session complete", or "No cards due" when it started empty. Both offer **Practice All** and **Go Home**.
- Exit (top-left) returns to the deck the session started from; Go Home always goes to the home screen.
- "Card N of M": N = distinct cards seen so far, so re-queued cards don't inflate the count.
- Keys: `1–4` rate (after reveal); `Space`/`Enter` reveal, or answer Good, only when focus isn't on a button/input.

### Auto-translate (`app.autoFillFromFront`)

Triggered by the card modal 400 ms after the front field stops changing (and **not** during IME composition, so typing pinyin/kana never sends half-typed text).

```
GET https://translate.googleapis.com/translate_a/single?client=gtx&sl=<source>&tl=<target>&dt=t&dt=rm&q=<front>
```

- Response: `data[0]` is a list of segments. Translation = every segment whose slot 0 is a string, concatenated.
  Romanization = slot 3 of the segment whose slot 0 is `null`.
- Fills `back` always, and `romanization` only when `needsRomanization(sourceLang)`.
- Skipped with an inline note when source = target language or the text is over 500 characters. Network failure shows an inline note; the user can type manually.
- **Stale-response protection:** each call bumps a sequence number and aborts the previous `fetch`. A response is applied only if
  its sequence is still current, the field is still in the DOM, and the field text still equals the queried text.
  Closing the modal calls `cancelAutoFill()`.

### Language pair changes

Library bar → `app.updateDeckLanguage` / `swapDeckLanguages` → `commit()` → column headers (`Front [English]`, `Back [Vietnamese]`),
the Romanization column, and the card modal all follow. Deck modal swap only swaps the dropdowns until Save.

---

## 7. UI and design system

All CSS is in the `<style>` block of `index.html` (see §9). Tokens are CSS variables on `:root`, with a `prefers-color-scheme: dark` override.

- **Concept:** an index-card file. Ink-blue on cool paper; the only decorative motif is the review card's red top rule and faint blue ruling, used nowhere else.
- **Type:** system font stacks only (no font downloads, works offline). Card faces use a serif stack (Palatino/Iowan/Songti/Noto Serif CJK…);
  UI uses a sans stack with CJK/Thai/Arabic/Devanagari fallbacks. Elements get a `lang` attribute (`utils.getHtmlLang`; `zh-CN`→`zh-Hans`) so browsers pick the right glyph variants.
- **Colour meaning:** Again = red, Hard = amber, Good = green, Easy = blue. Every rating button also carries a text label, so colour is never the only signal.
- **Responsive:** the card table becomes stacked rows under 760 px (using `data-label`); rating buttons go 2×2 under 520 px.
- **Accessibility:** native `<dialog>` (focus trap, Esc), labelled fields with `aria-invalid` + inline errors, `aria-live` progress and toasts,
  `:focus-visible` rings, reduced-motion respected. After navigation focus moves to the screen's heading; in review it moves to the primary button;
  in the library it is restored to the same control by `id` after a re-render.

---

## 8. Invariants: do not break these

1. **Content and progress stay separate.** Never store front/back/language in `vocab_progress`, or progress in `vocab_library`.
2. **No `innerHTML` with data.** Build DOM with `ui.h()`.
3. **Never pass `null`/`undefined` to `replaceChildren()`.** It turns them into the text "null". (`ui.h` filters them; `replaceChildren` does not. This shipped as a bug once.)
4. **All writes go through `storage`,** then `app.commit()`. Don't cache `library.decks`.
5. **`romanization` is `''` unless the source language needs it.** The card modal clears it on save for other languages.
6. **The scheduler stays language- and content-agnostic.**
7. **Keep the load order** in §2. `app.js` last.
8. **Anything that writes into modal content must run after `ui.openModal()`.** `setAutoFillNote` looks elements up by id in the document. This also shipped as a bug once.
9. **`ui.h` sets DOM *properties* when they exist.** `spellcheck: 'false'` becomes `true` (a non-empty string is truthy), so use `el.setAttribute('spellcheck','false')`.
10. **Timestamps are ms since epoch; review due dates are local midnight.** Use `utils.addDaysToToday`, not `+ 86400000`.

---

## 9. Decisions and trade-offs

| Decision | Why | Cost |
|---|---|---|
| **CSS is inline in `index.html`** | The spec's file structure listed no stylesheet, so it was kept literal | `index.html` is ~430 lines, ~390 of them CSS; no separate caching; noisier diffs. Extracting to `styles.css` is a one-line `<link>` change with no logic impact (proposed in `changelog.md`) |
| Unofficial Google Translate endpoint (`client=gtx`), no API key | Spec-mandated; zero setup | Unsupported: may rate-limit, change format, or block. Failure is handled gracefully but it is the app's most fragile dependency |
| `localStorage` only | Spec-mandated; no backend | ~5 MB quota; no cross-device sync; progress is not in deck exports |
| Full re-render per change | Simplest correct thing at this data size | Would need list virtualisation beyond several thousand cards (the library already paginates at 50) |
| Practice mode doesn't save progress | Cramming shouldn't distort the schedule | Users may expect it to count |
| "Due" includes new cards | One number, always actionable | No daily new-card limit (Anki has one) |

---

## 10. Known limitations and unverified areas

- **Two tabs open = last write wins.** There is no `storage` event listener, and each tab keeps its own in-memory copy, so a stale tab can overwrite newer data.
- **No undo** for a rating, and no daily new-card limit.
- Learning cards can reappear sooner than their real due time within a session (see the re-queue rule).
- No text-to-speech, no images or audio on cards, no tags.
- **Only tested in Chromium** (Playwright) at 1100×800/900 and 390×800, light and dark. Not tested in Firefox or Safari, or with a screen reader.
  Modern-CSS/APIs in use: `<dialog>`, Popover API (falls back), `:has()`, `color-scheme`, `Array.prototype.flatMap`, optional chaining.
- **The real Google endpoint was never called during development.** Its response was mocked in the shape described in §6. Verify with a live connection.
- Automated test suites were written and run in a scratch directory during the build. **They are not part of this repository.**

---

## 11. How to…

- **Add a language:** add `{code, label}` to `utils.LANGUAGES` (use the Google Translate code). If it needs a romanization field,
  add the code to `ROMANIZATION_LANGS` and a label to `ROMANIZATION_LABELS`. Nothing else changes.
- **Tune scheduling:** edit `scheduler.CONFIG` (steps in minutes, intervals in days, ease deltas).
- **Change page size:** `PAGE_SIZE` in `pages/library.js`. **Auto-translate delay:** `AUTOFILL_DELAY_MS` in `components/card-modal.js`.
- **Add a screen:** add a `<section id="screen-x">` and `#x-content` in `index.html`, add `'x'` to `ui.screens`,
  add a dispatch branch in `ui.render()`, and attach `ui.renderX` from a new script placed before `app.js`.
- **Change the export format:** bump `FORMAT_VERSION`, keep `parseImport` accepting old versions, and record it in `changelog.md` as a data-format change.
- **Change the stored data shape:** add migration to `sanitizeLibrary` / `sanitizeProgress` so existing users' data survives, and log it in `changelog.md`.
