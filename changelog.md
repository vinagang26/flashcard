# Cardfile: Changelog and Handoff Log

This file is the project's **unified change history and the handoff between sessions**. Every person or agent
who changes the project adds an entry here, in the form below, so the log reads the same no matter who wrote it.

- **Architecture and rules of the codebase:** `architect.md`. Read it first.
- **Current state and what to do next:** the **Handoff** block of the **newest entry** in this file.

---

## 0. Read this first (agents)

1. Read `architect.md` (structure, data model, invariants).
2. Read the **newest entry** below (right after the "Entries" heading), especially its **Handoff** block.
3. Skim older entries only if you need the reasoning behind a decision. Look at **Decisions** and **Gotchas**.
4. Do your work. Then **add a new entry at the top of "Entries"** using the form in section 1 before you finish.
   A change without an entry is unfinished.

### Rules for writing entries

- **Newest first. Append-only.** Never edit or delete an old entry. If it turns out to be wrong, add a new entry with type `Fixed`
  or `Changed` that refers to it by version.
- **One entry per work session/handoff**, even if small. Don't batch unrelated sessions.
- **Be specific and checkable.** Name files by path (`core/scheduler.js`), not "the scheduler". Say *what you ran* to verify, not "tested".
- **Say what you did not verify.** Unverified is fine; unlabelled is not.
- **Record decisions with the reason,** especially where the spec was silent or you deviated from it.
- **Flag data impact.** Any change to a localStorage key, the stored data shape, or the export file format needs a
  `Data / migration` line (write `None` if none). Existing users' data must keep loading.
- **Keep `architect.md` true.** If your change makes a statement there wrong, update it in the same session and tick the box in the entry.
- **Versioning (SemVer):** `MAJOR` = breaking data/format change; `MINOR` = new user-visible capability; `PATCH` = fixes and internal changes.
  There is no version constant in the code, so **this file is the source of truth**.
- **Change types** (use only these): `Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`, `Security`.
- **Dates:** ISO `YYYY-MM-DD`.
- **Author:** who or what wrote it (a person's name, or an agent with its model name) and, if known, who it was working for.

### Before you finish, check

- [ ] New entry added at the top, using the form
- [ ] Every changed file is listed under **Files**
- [ ] `Data / migration` filled in
- [ ] **Verification** says what was run and what was *not*
- [ ] **Handoff** lets a stranger continue without asking you anything
- [ ] `architect.md` still matches the code (or updated)

---

## 1. Entry form

Copy this block to the top of "Entries" and fill in every field. Write `None` or `n/a` instead of deleting a field.

```markdown
## [X.Y.Z] - YYYY-MM-DD

- **Author:** <name / agent + model>, working for <who>
- **Summary:** <one sentence: what changed and why it matters>
- **Type(s):** <Added | Changed | Fixed | Removed | Deprecated | Security>
- **Data / migration:** <localStorage keys, stored shape or export-format impact, and how old data is handled. `None` if none>
- **architect.md updated:** <yes (which sections) | no, not affected>

### Changes
- **Added:** <what, in user terms> (`path/to/file.js`)
- **Changed:** <what, and what it was before> (`path/to/file.js`)
- **Fixed:** <symptom, then root cause> (`path/to/file.js`)
- **Removed:** <what, and why>

### Files
| File | Change |
|---|---|
| `path/to/file` | created / modified / deleted: one line |

### Decisions
- <Decision>: <why>. <Alternatives considered, if any.> <Where the spec was silent or was deviated from.>

### Verification
- **Ran:** <exact commands / scenarios and results>
- **Not verified:** <browsers, devices, live services, etc.>

### Gotchas
- <A trap the next person would fall into. Mention how it was found if it cost time.>

### Handoff
- **State:** <working / partially working / broken, and what "working" was checked against>
- **Next steps:** <ordered, concrete, smallest first>
- **Open questions:** <things that need a human decision>
- **Do not touch without reading:** <fragile areas and the reason>
```

---

## Entries

## [0.1.0] - 2026-09-20

- **Author:** Claude (Anthropic agent, Sonnet 5), working for the project owner
- **Summary:** First complete build of Cardfile from `multilingual_flashcard_prompt.md`: multilingual decks with per-deck language pairs, auto-translate/romanization, SM-2 review, and deck export/import.
- **Type(s):** Added
- **Data / migration:** Introduces the storage keys `vocab_library`, `vocab_progress`, `vocab_meta` and export format `formatVersion: 2`.
  Data written by the original Chinese-only app (`hanzi`/`pinyin`/`meaning`, deck `language`) is migrated on load by `sanitizeLibrary`
  (treated as `zh-CN → en`). Export files with `formatVersion: 1` are converted on import. Corrupt storage is backed up to `<key>_corrupt_<timestamp>`.
- **architect.md updated:** yes, created in this session (all sections).

### Changes
- **Added:** Home screen: deck list with per-deck language badge, due/new counts, "Review all due" across decks, Import/New deck (`pages/home.js`).
- **Added:** Library screen: language-pair bar above everything (source ▼ ⇄ target ▼, persisted immediately), deck header, action bar
  (`+ New Card`, `Export`, `Import`, `Edit Deck`, `Delete Deck`, `← Back`), search, state filter, 50-per-page list with dynamic
  `Front [<lang>]` / `Back [<lang>]` headers, and a romanization column only for languages that need one (`pages/library.js`).
- **Added:** Card modal with 400 ms debounced auto-translate into the back field and auto-romanization (pinyin/romaji/etc.), IME-safe, stale-response-safe,
  deck selector when there are 2+ decks, inline validation (`components/card-modal.js`, `core/app.js`).
- **Added:** Deck create/edit modal with language pair (default English → Vietnamese) (`components/deck-manager.js`).
- **Added:** Review screen: front → Show answer → back + romanization + Again/Hard/Good/Easy with interval previews, keyboard shortcuts,
  Practice mode, empty and complete states (`pages/review.js`, `core/app.js`).
- **Added:** SM-2 scheduler with Anki-style learning/relearning steps (`core/scheduler.js`).
- **Added:** Deck export to JSON and import with conflict resolution (Merge / Update / Replace / Cancel), legacy v1 import (`services/deck-portability.js`, `components/import-modal.js`).
- **Added:** 15 languages; romanization for `zh-CN zh-TW ja ko ar hi th` (`utils/helpers.js`).
- **Added:** Light/dark themes, responsive layout, accessible modals/labels/focus handling (`index.html`, `ui.js`).
- **Fixed** (found during pre-release testing, so no user ever saw these):
  - Literal text "null" rendered above the review card, because `replaceChildren(null)` stringifies `null` (`pages/review.js`).
  - "Same language" warning never appeared in the card modal, because it was written before the modal was in the DOM (`components/card-modal.js`).
  - "Go Home" on the session-complete screen returned to the deck instead of home. Added `app.goHome()` (`core/app.js`, `pages/review.js`).
  - Searching `xuexi` did not find `xuéxí`. Added accent-insensitive `utils.foldText` for search (`utils/helpers.js`, `pages/library.js`).
  - Mobile stacked table label said "Romanization" in italics instead of the language-specific name (`pages/library.js`, `index.html`).

### Files
| File | Change |
|---|---|
| `index.html` | created: shell, **all CSS inline**, ordered `defer` scripts |
| `ui.js` | created: `h()` helper, screens, `<dialog>` modal, confirm, popover toast, language-pair widget |
| `utils/helpers.js` | created: languages, romanization rules, ids, dates, validation, `foldText` |
| `services/storage.js` | created: localStorage layer, sanitise/migrate, batch writes |
| `services/deck-portability.js` | created: export / parse / analyse / apply import |
| `core/scheduler.js` | created: SM-2 + learning steps |
| `core/app.js` | created: navigation, sessions, mutations, auto-translate |
| `pages/home.js`, `pages/library.js`, `pages/review.js` | created: screens |
| `components/deck-manager.js`, `card-modal.js`, `import-modal.js` | created: modals |
| `architect.md`, `changelog.md` | created |

### Decisions
- **CSS is inline in `index.html`** because the spec's file structure listed no stylesheet and asked for plain HTML/JS/CSS. Kept literal.
  Trade-off recorded in `architect.md` §9. Extraction to `styles.css` is proposed under Next steps.
- **Scheduler details were "same as original" in the spec but the original wasn't available,** so Anki defaults were chosen
  (steps 1m/10m, graduate 1d, easy 4d, ease 2.5, floor 1.3, hard ×1.2, easy ×1.3, lapse → 10m relearning).
- **Import conflict semantics** (Merge / Update / Replace) were defined here, since the spec named them without defining them. Merge is the default because it is non-destructive.
- **Practice mode never saves progress** and shows no interval previews. Again/Hard re-queue a learning card ≤4 cards later; other learning cards go to the end.
- **"Due" includes new cards;** there is no daily new-card limit.
- **Search ignores accents/tone marks** because people type pinyin and Vietnamese without them.
- **System font stacks only,** so the app stays offline-capable and dependency-free.
- **Additions beyond the spec:** "Review N due" button in the deck header, light/dark themes, keyboard shortcuts, mobile stacked table, search + state filter, legacy-format migration.

### Verification
- **Ran (Chromium via Playwright, Google Translate response mocked):**
  - 48 browser checks covering the spec's verification checklist: deck creation defaults, dynamic labels, romanization visibility,
    auto-fill, validation, swap/target change and persistence, review flow (Again re-queue, Good graduates), practice, export/import including conflicts, refresh persistence, delete, network failure.
  - 45 further browser checks: pagination, combined review across decks, edit deck/card, moving a card keeps progress, debounce, IME composition, stale-response handling,
    v1 import, script-injection attempt stays inert, corrupt-storage recovery, no horizontal overflow at 390 px.
  - 30 Node unit checks on `scheduler` and `utils` (learning steps, lapses, ease floor, monotonic intervals, 300-step random simulation).
  - Screenshots reviewed at desktop and 390 px, light and dark.
- **Not verified:**
  - The **real** Google Translate endpoint (no network in the build sandbox); only the documented response shape was mocked.
  - Firefox, Safari, real phones; screen readers; `file://` behaviour in every browser.
  - More than a few hundred cards' worth of performance in real use (the 120-card pagination case was tested).
  - **The test suites themselves are not in the repository** (they were scratch files in the sandbox).

### Gotchas
- `replaceChildren(null)` writes the text "null" (see `architect.md` §8, rule 3).
- `ui.h` assigns DOM *properties* when they exist, so `spellcheck: 'false'` ends up `true` (rule 9).
- `storage.deleteDeck` reassigns `library.decks`; don't hold a reference to the old array (rule 4).
- Anything targeting `#auto-fill-note` must run after `ui.openModal()` (rule 8).
- Two open tabs overwrite each other (no `storage` event handling).
- In Playwright, `has-text()` is case-insensitive and substring-based, so `button:has-text('Import')` also matches "Import deck" on a hidden screen. Scope selectors (`#modal …`, `#library-content …`) when writing tests.

### Handoff
- **State:** Working. It behaves per the spec's checklist in Chromium with a mocked translate endpoint, and the owner confirmed it works when run.
- **Next steps:**
  1. Have the owner confirm auto-translate against the live Google endpoint (fastest way to catch a real-world difference).
  2. *(Proposed, not done)* Extract the `<style>` block from `index.html` into `styles.css` and link it: no logic changes, needs an entry (`Changed`).
  3. *(Suggested)* Add the test suites to the repo (`tests/`) so verification is repeatable, and note it here.
  4. *(Suggested)* Listen to the `storage` event (or re-read before write) to make multiple tabs safe.
  5. *(Optional product work)* Undo last rating, daily new-card limit, TTS for the front, tags.
- **Open questions:** Should practice sessions count toward the schedule? Should progress travel with exported decks (would need format `formatVersion: 3`)? Keep the unofficial translate endpoint or move to a keyed API?
- **Do not touch without reading:** `core/scheduler.js` (existing users' progress depends on the field names and semantics), the load order in `index.html`,
  and `services/storage.js` `sanitizeLibrary` (it is the migration path for all stored data).
