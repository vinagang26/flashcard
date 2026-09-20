/* services/storage.js
 * All localStorage reads and writes live here (global `storage`).
 *
 * Keeps the parsed data in memory and writes through on every mutation.
 * Objects returned by getLibrary()/getProgress() are never replaced after init(),
 * so other modules may safely hold references to them.
 *
 *   vocab_library  → { decks: [...], cards: { [id]: {...} } }   (content only)
 *   vocab_progress → { [cardId]: { state, step, easeFactor, ... } } (SM-2 only)
 *   vocab_meta     → { lastOpened: { [deckId]: timestamp } }
 */
const storage = (() => {
  const KEYS = {
    library: 'vocab_library',
    progress: 'vocab_progress',
    meta: 'vocab_meta',
  };

  let library = { decks: [], cards: {} };
  let progress = {};
  let meta = { lastOpened: {} };

  let batchDepth = 0;
  const pending = { library: false, progress: false, meta: false };
  let errorHandler = null;

  /* ---------- low-level I/O ---------- */

  function reportError(err) {
    console.error('[storage]', err);
    if (typeof errorHandler === 'function') errorHandler(err);
  }

  function read(key, fallback) {
    let raw = null;
    try {
      raw = localStorage.getItem(key);
    } catch (err) {
      reportError(err);
      return fallback;
    }
    if (raw == null) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (err) {
      // Keep the unreadable data around instead of silently overwriting it.
      try { localStorage.setItem(`${key}_corrupt_${Date.now()}`, raw); } catch (_) { /* ignore */ }
      console.warn(`[storage] "${key}" was unreadable and has been backed up.`);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      reportError(err);
      return false;
    }
  }

  function flush() {
    if (pending.library && write(KEYS.library, library)) pending.library = false;
    if (pending.progress && write(KEYS.progress, progress)) pending.progress = false;
    if (pending.meta && write(KEYS.meta, meta)) pending.meta = false;
  }

  function touch(name) {
    pending[name] = true;
    if (batchDepth === 0) flush();
  }

  /** Run several mutations and write to localStorage once at the end. */
  function batch(fn) {
    batchDepth++;
    try {
      return fn();
    } finally {
      batchDepth--;
      if (batchDepth === 0) flush();
    }
  }

  /* ---------- sanitising (also migrates the old hanzi/pinyin/meaning schema) ---------- */

  function sanitizeLibrary(raw) {
    const out = { decks: [], cards: {} };
    const rawDecks = Array.isArray(raw && raw.decks) ? raw.decks : [];
    const rawCards = raw && raw.cards && typeof raw.cards === 'object' ? raw.cards : {};

    const deckIds = new Set();
    rawDecks.forEach((d) => {
      if (!d || typeof d !== 'object' || !d.id || deckIds.has(d.id)) return;
      deckIds.add(d.id);
      const legacy = d.language != null && d.sourceLang == null;
      out.decks.push({
        id: String(d.id),
        name: String(d.name || 'Untitled deck'),
        description: String(d.description || ''),
        author: String(d.author || ''),
        sourceLang: d.sourceLang || (legacy ? 'zh-CN' : 'en'),
        targetLang: d.targetLang || (legacy ? 'en' : 'vi'),
        cardIds: Array.isArray(d.cardIds) ? d.cardIds.slice() : [],
      });
    });

    Object.keys(rawCards).forEach((key) => {
      const c = rawCards[key];
      if (!c || typeof c !== 'object') return;
      const id = String(c.id || key);
      if (!deckIds.has(c.deckId)) return;
      out.cards[id] = {
        id,
        deckId: c.deckId,
        front: String(c.front != null ? c.front : c.hanzi != null ? c.hanzi : ''),
        romanization: String(c.romanization != null ? c.romanization : c.pinyin != null ? c.pinyin : ''),
        back: String(c.back != null ? c.back : c.meaning != null ? c.meaning : ''),
        exampleSentence: String(c.exampleSentence || ''),
      };
    });

    // Make deck.cardIds and card.deckId agree with each other.
    out.decks.forEach((deck) => {
      const seen = new Set();
      deck.cardIds = deck.cardIds.filter((id) => {
        const ok = out.cards[id] && out.cards[id].deckId === deck.id && !seen.has(id);
        if (ok) seen.add(id);
        return ok;
      });
      Object.values(out.cards).forEach((card) => {
        if (card.deckId === deck.id && !seen.has(card.id)) {
          deck.cardIds.push(card.id);
          seen.add(card.id);
        }
      });
    });
    return out;
  }

  function sanitizeProgress(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach((id) => {
      if (raw[id] && typeof raw[id] === 'object') out[id] = raw[id];
    });
    return out;
  }

  /* ---------- lifecycle ---------- */

  function init() {
    library = sanitizeLibrary(read(KEYS.library, null));
    progress = sanitizeProgress(read(KEYS.progress, null));
    const m = read(KEYS.meta, null);
    meta = { lastOpened: (m && m.lastOpened && typeof m.lastOpened === 'object') ? m.lastOpened : {} };
  }

  function persist() {
    pending.library = pending.progress = pending.meta = true;
    flush();
  }

  /* ---------- getters ---------- */

  const getLibrary = () => library;
  const getProgress = () => progress;
  const getDeck = (id) => library.decks.find((d) => d.id === id) || null;
  const getCard = (id) => library.cards[id] || null;
  const getCardProgress = (id) => progress[id] || null;

  /* ---------- decks ---------- */

  /** Creates a deck, or updates it when `deckData.id` already exists. */
  function saveDeck(deckData) {
    let deck = deckData.id ? getDeck(deckData.id) : null;
    if (!deck) {
      deck = { id: deckData.id || utils.generateId(), cardIds: [] };
      library.decks.push(deck);
    }
    deck.name = String(deckData.name || '').trim() || 'Untitled deck';
    deck.description = String(deckData.description || '').trim();
    deck.author = String(deckData.author || '').trim();
    deck.sourceLang = deckData.sourceLang || 'en';
    deck.targetLang = deckData.targetLang || 'vi';
    touch('library');
    return deck;
  }

  /** Removes the deck together with its cards and their SM-2 progress. */
  function deleteDeck(deckId) {
    const deck = getDeck(deckId);
    if (!deck) return false;
    deck.cardIds.forEach((id) => {
      delete library.cards[id];
      delete progress[id];
    });
    library.decks = library.decks.filter((d) => d.id !== deckId);
    delete meta.lastOpened[deckId];
    touch('library');
    touch('progress');
    touch('meta');
    return true;
  }

  /* ---------- cards ---------- */

  /**
   * Creates a card, or updates it when `cardData.id` already exists.
   * Passing a different deckId moves an existing card (its progress is kept).
   */
  function saveCard(cardData, deckId) {
    const deck = getDeck(deckId);
    if (!deck) throw new Error('Deck not found.');

    let card = cardData.id ? library.cards[cardData.id] : null;
    if (card) {
      if (card.deckId !== deckId) {
        const oldDeck = getDeck(card.deckId);
        if (oldDeck) oldDeck.cardIds = oldDeck.cardIds.filter((id) => id !== card.id);
        deck.cardIds.push(card.id);
        card.deckId = deckId;
      }
    } else {
      card = { id: cardData.id || utils.generateId(), deckId };
      library.cards[card.id] = card;
      deck.cardIds.push(card.id);
    }

    card.front = String(cardData.front || '').trim();
    card.romanization = String(cardData.romanization || '').trim();
    card.back = String(cardData.back || '').trim();
    card.exampleSentence = String(cardData.exampleSentence || '').trim();
    touch('library');
    return card;
  }

  function deleteCard(cardId) {
    const card = getCard(cardId);
    if (!card) return false;
    const deck = getDeck(card.deckId);
    if (deck) deck.cardIds = deck.cardIds.filter((id) => id !== cardId);
    delete library.cards[cardId];
    delete progress[cardId];
    touch('library');
    touch('progress');
    return true;
  }

  /* ---------- progress ---------- */

  function saveCardProgress(cardId, cardProgress) {
    progress[cardId] = cardProgress;
    touch('progress');
  }

  /* ---------- meta ---------- */

  function recordDeckOpen(deckId) {
    meta.lastOpened[deckId] = Date.now();
    touch('meta');
  }

  const getLastOpened = (deckId) => meta.lastOpened[deckId] || 0;

  return {
    KEYS,
    init,
    persist,
    batch,
    getLibrary,
    getProgress,
    getDeck,
    getCard,
    getCardProgress,
    saveDeck,
    deleteDeck,
    saveCard,
    deleteCard,
    saveCardProgress,
    recordDeckOpen,
    getLastOpened,
    onError(fn) { errorHandler = fn; },
  };
})();
