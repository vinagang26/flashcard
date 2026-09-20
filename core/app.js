/* core/app.js
 * Top-level controller (global `app`). Owns navigation, review sessions and auto-translate.
 * Data lives in `storage`; the UI lives in `ui`.
 */
const app = {
  screen: 'home',
  activeDeck: null,          // full deck object (needs sourceLang / targetLang)
  session: null,             // current review session, see startReview()
  pendingImport: null,       // parsed import waiting for a conflict decision
  _autoFill: { seq: 0, controller: null },

  get library() { return storage.getLibrary(); },
  get progress() { return storage.getProgress(); },

  /* ------------------------------------------------------------------ */
  /* lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  init() {
    storage.onError(() => ui.toast(
      'Couldn’t save your changes. Browser storage may be full or blocked. Export your decks to keep a copy.',
      'error',
    ));
    storage.init();
    ui.init();
    document.getElementById('brand-home').addEventListener('click', () => this.showScreen('home'));
    this.showScreen('home');
  },

  /** Persist everything, then re-render the visible screen. */
  commit() {
    storage.persist();
    this.syncActiveDeck();
    ui.render();
  },

  showScreen(name) {
    this.screen = name;
    ui.showScreen(name);
    ui.render();
    window.scrollTo(0, 0);
    const heading = document.querySelector(`#screen-${name} h1, #screen-${name} h2`);
    if (heading) heading.focus({ preventScroll: true });
  },

  syncActiveDeck() {
    if (this.activeDeck) this.activeDeck = storage.getDeck(this.activeDeck.id);
  },

  getActiveDeck() {
    this.syncActiveDeck();
    return this.activeDeck;
  },

  /* ------------------------------------------------------------------ */
  /* decks                                                               */
  /* ------------------------------------------------------------------ */

  getSortedDecks() {
    return this.library.decks.slice().sort((a, b) =>
      (storage.getLastOpened(b.id) - storage.getLastOpened(a.id)) || a.name.localeCompare(b.name));
  },

  openDeck(deckId) {
    const deck = storage.getDeck(deckId);
    if (!deck) return;
    this.activeDeck = deck;
    this.recordDeckOpen(deckId);
    this.showScreen('library');
  },

  recordDeckOpen(deckId) {
    storage.recordDeckOpen(deckId);
  },

  /** Create or update a deck. Returns true on success. */
  saveDeck(data) {
    const name = String(data.name || '').trim();
    if (!name) { ui.toast('Enter a deck name.', 'error'); return false; }
    const isEdit = Boolean(data.id && storage.getDeck(data.id));
    const deck = storage.saveDeck({ ...data, name });
    if (isEdit) {
      this.commit();
      ui.toast('Deck saved.');
    } else {
      ui.toast('Deck created.');
      this.openDeck(deck.id);
    }
    return true;
  },

  async deleteDeck(deckId) {
    const deck = storage.getDeck(deckId);
    if (!deck) return;
    const ok = await ui.confirm({
      title: `Delete “${deck.name}”?`,
      message: `This permanently deletes the deck, its ${utils.pluralize(deck.cardIds.length, 'card')} and all review progress. Export it first if you want a backup.`,
      confirmLabel: 'Delete deck',
      danger: true,
    });
    if (!ok) return;
    storage.deleteDeck(deckId);
    if (this.activeDeck && this.activeDeck.id === deckId) this.activeDeck = null;
    ui.toast('Deck deleted.');
    this.showScreen('home');
  },

  /** field: 'sourceLang' | 'targetLang' */
  updateDeckLanguage(deckId, field, langCode) {
    const deck = storage.getDeck(deckId);
    if (!deck || !['sourceLang', 'targetLang'].includes(field)) return;
    deck[field] = langCode;
    this.commit();
  },

  swapDeckLanguages(deckId) {
    const deck = storage.getDeck(deckId);
    if (!deck) return;
    [deck.sourceLang, deck.targetLang] = [deck.targetLang, deck.sourceLang];
    this.commit();
  },

  /* ------------------------------------------------------------------ */
  /* cards                                                               */
  /* ------------------------------------------------------------------ */

  openCardModal(cardId = null) {
    const card = cardId ? storage.getCard(cardId) : null;
    const deck = card ? storage.getDeck(card.deckId) : this.getActiveDeck();
    if (!deck) { ui.toast('Open a deck first.', 'error'); return; }
    ui.showCardModal(card, deck);
  },

  /** Returns true on success. */
  saveCard(cardData, deckId) {
    const { valid } = utils.validateCard(cardData);
    if (!valid || !storage.getDeck(deckId)) return false;
    const isEdit = Boolean(cardData.id && storage.getCard(cardData.id));
    storage.saveCard(cardData, deckId);
    this.commit();
    ui.toast(isEdit ? 'Card updated.' : 'Card added.');
    return true;
  },

  async deleteCard(cardId) {
    const card = storage.getCard(cardId);
    if (!card) return;
    const ok = await ui.confirm({
      title: 'Delete this card?',
      message: `“${card.front}” and its review progress will be permanently deleted.`,
      confirmLabel: 'Delete card',
      danger: true,
    });
    if (!ok) return;
    storage.deleteCard(cardId);
    this.commit();
    ui.toast('Card deleted.');
  },

  /* ------------------------------------------------------------------ */
  /* stats + due cards                                                   */
  /* ------------------------------------------------------------------ */

  /** Every card in every deck, in deck order. */
  getCombinedCards() {
    return this.library.decks.flatMap((d) => d.cardIds.map((id) => storage.getCard(id)).filter(Boolean));
  },

  /** Cards due now, for one deck (or every deck when deckId is null/undefined). Learning cards first. */
  getDueCards(deckId = null) {
    const now = Date.now();
    const cards = deckId
      ? (storage.getDeck(deckId)?.cardIds || []).map((id) => storage.getCard(id)).filter(Boolean)
      : this.getCombinedCards();
    const rank = (c) => {
      const p = this.progress[c.id];
      if (!p || p.state === 'new') return 2;
      return p.state === 'review' ? 1 : 0;
    };
    return cards
      .filter((c) => scheduler.isDue(this.progress[c.id], now))
      .sort((a, b) => {
        const ra = rank(a), rb = rank(b);
        if (ra !== rb) return ra - rb;
        return ((this.progress[a.id] || {}).nextReviewAt || 0) - ((this.progress[b.id] || {}).nextReviewAt || 0);
      });
  },

  /** → { total, due, new, learning, review }. `due` includes new cards. */
  getDeckStats(deckId) {
    const deck = storage.getDeck(deckId);
    const stats = { total: 0, due: 0, new: 0, learning: 0, review: 0 };
    if (!deck) return stats;
    const now = Date.now();
    deck.cardIds.forEach((id) => {
      const p = this.progress[id];
      stats.total++;
      if (!p || p.state === 'new') { stats.new++; stats.due++; return; }
      if (p.state === 'review') stats.review++; else stats.learning++;
      if (p.nextReviewAt <= now) stats.due++;
    });
    return stats;
  },

  /* ------------------------------------------------------------------ */
  /* review session                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * startReview({ deckId, practice, cardIds })
   *   deckId    – limit to one deck; null/undefined = all decks combined
   *   practice  – true: go through every card (shuffled) without touching saved SM-2 progress
   *   cardIds   – review exactly these cards (used by the per-card Practice button)
   */
  startReview({ deckId = null, practice = false, cardIds = null } = {}) {
    let cards;
    if (cardIds) {
      cards = cardIds.map((id) => storage.getCard(id)).filter(Boolean);
    } else if (practice) {
      cards = deckId
        ? (storage.getDeck(deckId)?.cardIds || []).map((id) => storage.getCard(id)).filter(Boolean)
        : this.getCombinedCards();
    } else {
      cards = this.getDueCards(deckId);
    }
    if (practice || cardIds) cards = utils.shuffle(cards);

    this.session = {
      deckId,
      practice: Boolean(practice || cardIds),
      queue: cards.map((c) => c.id),
      total: cards.length,
      seen: new Set(),
      reviewed: 0,           // ratings given (a card answered "Again" counts each time)
      revealed: false,
      temp: {},              // practice-mode progress, never saved
    };
    if (practice && cards.length === 0) {
      ui.toast('There are no cards to practice yet.', 'info');
      return;
    }
    this.showScreen('review');
  },

  currentCard() {
    const s = this.session;
    return s && s.queue.length ? storage.getCard(s.queue[0]) : null;
  },

  /** The progress used for the current card: practice copy → saved → fresh. */
  getCardProgress(cardId) {
    const s = this.session;
    if (s && s.practice && s.temp[cardId]) return s.temp[cardId];
    return this.progress[cardId] || scheduler.initCard();
  },

  refreshReview() {
    const s = this.session;
    if (!s) { this.showScreen('home'); return; }
    const card = this.currentCard();
    if (card) s.seen.add(card.id);
    const deck = card ? storage.getDeck(card.deckId) : (s.deckId ? storage.getDeck(s.deckId) : null);
    ui.renderReview(s.total, Math.min(s.seen.size, s.total), card, s.revealed, deck);
  },

  revealCard() {
    const s = this.session;
    if (!s || s.revealed || !s.queue.length) return;
    s.revealed = true;
    ui.render();
  },

  /** rating: 'again' | 'hard' | 'good' | 'easy' (or 1-4) */
  submitRating(rating) {
    const s = this.session;
    if (!s || !s.revealed || !s.queue.length) return;

    const id = s.queue.shift();
    const previous = this.getCardProgress(id);
    const next = scheduler.processReview(previous, rating);
    if (s.practice) s.temp[id] = next;
    else storage.saveCardProgress(id, next);
    s.reviewed++;

    // Cards still in a learning step come back later in this session:
    // "Again"/"Hard" after a few cards, an advanced step at the end of the queue.
    if (next.state === 'learning' || next.state === 'relearning') {
      const r = typeof rating === 'string' ? scheduler.RATING[rating.toUpperCase()] : rating;
      const slot = (r === scheduler.RATING.AGAIN || r === scheduler.RATING.HARD)
        ? Math.min(s.queue.length, 4)
        : s.queue.length;
      s.queue.splice(slot, 0, id);
    }

    s.revealed = false;
    this.commit();
  },

  goHome() {
    this.session = null;
    this.showScreen('home');
  },

  /** Leave the session and return to where it was started (the deck, or home for combined reviews). */
  exitReview() {
    const deckId = this.session && this.session.deckId;
    this.session = null;
    if (deckId && storage.getDeck(deckId)) this.openDeck(deckId);
    else this.showScreen('home');
  },

  /* ------------------------------------------------------------------ */
  /* export / import                                                     */
  /* ------------------------------------------------------------------ */

  exportDeckById(deckId) {
    try {
      const count = deckPortability.exportDeck(deckId);
      ui.toast(`Exported ${utils.pluralize(count, 'card')}.`);
    } catch (err) {
      ui.toast(err.message, 'error');
    }
  },

  /** Opens a file picker, then imports (asking what to do if the deck already exists). */
  importDeck() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const text = await deckPortability.readFile(file);
        const parsed = deckPortability.parseImport(text);
        if (parsed.error) { ui.toast(parsed.error, 'error'); return; }
        if (parsed.deck.cards.length === 0) {
          ui.toast('This deck file has no valid cards to import.', 'error');
          return;
        }
        const analysis = deckPortability.analyzeImport(parsed.deck);
        analysis.skipped = parsed.skipped;
        this.pendingImport = analysis;

        if (analysis.existing) {
          ui.showImportConflictModal(analysis);
        } else {
          this.handleImportResolution('new');
        }
      } catch (err) {
        ui.toast(err.message || 'Couldn’t import this file.', 'error');
      }
    });
    input.click();
  },

  /** resolution: 'new' | 'update' | 'merge' | 'replace' | 'cancel' */
  handleImportResolution(resolution) {
    const pending = this.pendingImport;
    this.pendingImport = null;
    ui.closeModal();
    if (!pending || resolution === 'cancel') return;

    const result = deckPortability.applyImport(
      pending.incoming,
      resolution,
      pending.existing ? pending.existing.id : null,
    );

    const parts = [`${utils.pluralize(result.added, 'card')} added`];
    if (result.updated) parts.push(`${result.updated} updated`);
    if (pending.skipped) parts.push(`${pending.skipped} skipped (missing front or back)`);
    ui.toast(`Imported “${pending.incoming.name}”: ${parts.join(', ')}.`);
    this.openDeck(result.deckId);
  },

  /* ------------------------------------------------------------------ */
  /* auto-translate                                                      */
  /* ------------------------------------------------------------------ */

  /** Called by the card modal (debounced 400 ms) whenever the front field changes. */
  triggerAutoFill(frontValue) {
    const ctx = ui.cardModalContext;
    if (!ctx) return;
    this.autoFillFromFront(frontValue, ctx.deck, ctx.frontEl, ctx.backEl, ctx.romanizationEl);
  },

  /** Abort any in-flight request (modal closed, deck changed…). */
  cancelAutoFill() {
    const st = this._autoFill;
    st.seq++;
    if (st.controller) st.controller.abort();
    st.controller = null;
    ui.showAutoFillLoading(false);
  },

  /**
   * Translates `frontValue` from deck.sourceLang to deck.targetLang and fills the back field.
   * Also fills romanization when the source language needs one (pinyin, romaji…).
   */
  async autoFillFromFront(frontValue, deck, frontEl, backEl, romanizationEl) {
    const st = this._autoFill;
    const query = String(frontValue || '').trim();

    if (st.controller) st.controller.abort();
    st.controller = null;
    const seq = ++st.seq;
    ui.setAutoFillNote('');
    ui.showAutoFillLoading(false);

    if (!query || !deck) return;
    if (deck.sourceLang === deck.targetLang) {
      ui.setAutoFillNote('Source and target language are the same.', 'warn');
      return;
    }
    if (query.length > 500) {
      ui.setAutoFillNote('This is too long to translate automatically. Enter the back yourself.', 'warn');
      return;
    }

    const controller = new AbortController();
    st.controller = controller;
    ui.showAutoFillLoading(true);

    const url = 'https://translate.googleapis.com/translate_a/single'
      + `?client=gtx&sl=${encodeURIComponent(deck.sourceLang)}&tl=${encodeURIComponent(deck.targetLang)}`
      + `&dt=t&dt=rm&q=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Ignore stale answers: a newer request started, the modal closed, or the text changed.
      if (seq !== st.seq || !frontEl.isConnected || frontEl.value.trim() !== query) return;

      const { translation, romanization } = this.parseTranslateResponse(data);
      if (!translation) {
        ui.setAutoFillNote('No translation found. Enter the back yourself.', 'warn');
        return;
      }
      backEl.value = translation;
      if (romanizationEl && utils.needsRomanization(deck.sourceLang)) {
        romanizationEl.value = romanization;
      }
    } catch (err) {
      if (err.name === 'AbortError' || seq !== st.seq) return;
      ui.setAutoFillNote('Couldn’t fetch a translation. Check your connection or enter the back yourself.', 'warn');
    } finally {
      if (seq === st.seq) {
        st.controller = null;
        ui.showAutoFillLoading(false);
      }
    }
  },

  /**
   * Response shape (dt=t & dt=rm):
   *   data[0] = [ [translated, original, …], …more sentences…, [null, null, targetRomanization, sourceRomanization] ]
   * Translation = every segment with a string in slot 0; romanization = slot 3 of the segment without one.
   */
  parseTranslateResponse(data) {
    const segments = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : [];
    let translation = '';
    let romanization = '';
    segments.forEach((seg) => {
      if (!Array.isArray(seg)) return;
      if (typeof seg[0] === 'string') translation += seg[0];
      else if (!romanization && typeof seg[3] === 'string') romanization = seg[3];
    });
    return { translation: translation.trim(), romanization: romanization.trim() };
  },
};

// Scripts are `defer`red, so the DOM is ready by the time this runs.
app.init();
