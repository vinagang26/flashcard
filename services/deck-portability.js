/* services/deck-portability.js
 * Export / import decks as JSON files (global `window.deckPortability`).
 *
 * Format (formatVersion 2):
 *   { type: 'vocab-deck-export', formatVersion: 2, exportedAt,
 *     deck: { id, name, author, description, sourceLang, targetLang,
 *             cards: [{ id, front, romanization, back, exampleSentence }] } }
 *
 * Files from the original Chinese→English app (formatVersion 1, with
 * hanzi/pinyin/meaning) are converted on import.
 *
 * SM-2 progress is deliberately not exported: a deck file is content only.
 */
window.deckPortability = (() => {
  const EXPORT_TYPE = 'vocab-deck-export';
  const FORMAT_VERSION = 2;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;

  /* ---------- export ---------- */

  function buildExport(deck, cards) {
    return {
      type: EXPORT_TYPE,
      formatVersion: FORMAT_VERSION,
      exportedAt: Date.now(),
      deck: {
        id: deck.id,
        name: deck.name,
        author: deck.author || '',
        description: deck.description || '',
        sourceLang: deck.sourceLang,
        targetLang: deck.targetLang,
        cards: cards.map((c) => ({
          id: c.id,
          front: c.front,
          romanization: c.romanization || '',
          back: c.back,
          exampleSentence: c.exampleSentence || '',
        })),
      },
    };
  }

  function slugify(name) {
    const slug = String(name || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    return slug || 'deck';
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Downloads the deck as JSON. Returns the number of cards exported. */
  function exportDeck(deckId) {
    const deck = storage.getDeck(deckId);
    if (!deck) throw new Error('Deck not found.');
    const cards = deck.cardIds.map((id) => storage.getCard(id)).filter(Boolean);
    downloadJson(`${slugify(deck.name)}.deck.json`, buildExport(deck, cards));
    return cards.length;
  }

  /* ---------- import: parsing ---------- */

  function normalizeCard(raw, legacy) {
    if (!raw || typeof raw !== 'object') return null;
    const front = String(legacy ? raw.hanzi : raw.front != null ? raw.front : '').trim();
    const back = String(legacy ? raw.meaning : raw.back != null ? raw.back : '').trim();
    if (!front || !back) return null;
    return {
      id: raw.id ? String(raw.id) : '',
      front,
      romanization: String(legacy ? raw.pinyin || '' : raw.romanization || '').trim(),
      back,
      exampleSentence: String(raw.exampleSentence || '').trim(),
    };
  }

  /**
   * Validates and normalises the text of an export file.
   * → { deck, skipped } on success, { error } on failure.
   */
  function parseImport(text) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (_) {
      return { error: 'This file isn’t valid JSON.' };
    }
    if (!raw || raw.type !== EXPORT_TYPE || !raw.deck || typeof raw.deck !== 'object') {
      return { error: 'This doesn’t look like a deck exported from Cardfile.' };
    }
    if (![1, 2].includes(raw.formatVersion)) {
      return { error: `Unsupported deck format (version ${raw.formatVersion}).` };
    }
    if (!Array.isArray(raw.deck.cards)) {
      return { error: 'The deck in this file has no card list.' };
    }

    const legacy = raw.formatVersion === 1;
    const seenIds = new Set();
    const cards = [];
    let skipped = 0;
    raw.deck.cards.forEach((c) => {
      const card = normalizeCard(c, legacy);
      if (!card) { skipped++; return; }
      if (card.id && seenIds.has(card.id)) card.id = '';   // duplicate ids inside the file
      if (card.id) seenIds.add(card.id);
      cards.push(card);
    });

    const d = raw.deck;
    return {
      skipped,
      deck: {
        id: d.id ? String(d.id) : '',
        name: String(d.name || '').trim() || 'Imported deck',
        author: String(d.author || ''),
        description: String(d.description || ''),
        sourceLang: d.sourceLang || (legacy ? 'zh-CN' : 'en'),
        targetLang: d.targetLang || (legacy ? 'en' : 'vi'),
        cards,
      },
    };
  }

  function readFile(file) {
    if (file.size > MAX_FILE_BYTES) {
      return Promise.reject(new Error('This file is larger than 10 MB.'));
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Couldn’t read this file.'));
      reader.readAsText(file);
    });
  }

  /* ---------- import: conflicts ---------- */

  function findExistingCard(existingCards, incomingCard) {
    const byId = incomingCard.id && existingCards.find((c) => c.id === incomingCard.id);
    if (byId) return byId;
    const front = utils.normalizeText(incomingCard.front);
    return existingCards.find((c) => utils.normalizeText(c.front) === front) || null;
  }

  /**
   * Compares an incoming deck with the library.
   * → { incoming, existing, matchedBy: 'id' | 'name' | null, newCards, overlappingCards }
   */
  function analyzeImport(incoming) {
    const library = storage.getLibrary();
    let existing = incoming.id ? library.decks.find((d) => d.id === incoming.id) : null;
    let matchedBy = existing ? 'id' : null;
    if (!existing) {
      const name = utils.normalizeText(incoming.name);
      existing = library.decks.find((d) => utils.normalizeText(d.name) === name) || null;
      matchedBy = existing ? 'name' : null;
    }

    let newCards = incoming.cards.length;
    let overlappingCards = 0;
    if (existing) {
      const existingCards = existing.cardIds.map((id) => storage.getCard(id)).filter(Boolean);
      overlappingCards = incoming.cards.filter((c) => findExistingCard(existingCards, c)).length;
      newCards = incoming.cards.length - overlappingCards;
    }
    return { incoming, existing, matchedBy, newCards, overlappingCards };
  }

  /* ---------- import: applying ---------- */

  /**
   * mode: 'new'     – no conflict, create the deck
   *       'update'  – overwrite matching cards + deck details, add the rest, keep unmatched existing cards
   *       'merge'   – keep everything that exists, only add cards that aren't there yet
   *       'replace' – delete the existing deck (cards and progress) and import fresh
   * → { deckId, added, updated }
   */
  function applyImport(incoming, mode, existingDeckId) {
    const result = { deckId: null, added: 0, updated: 0 };

    storage.batch(() => {
      const library = storage.getLibrary();
      let deck = existingDeckId ? storage.getDeck(existingDeckId) : null;

      if (mode === 'replace' && deck) {
        storage.deleteDeck(deck.id);
        deck = null;
      }

      if (!deck) {
        const idFree = incoming.id && !storage.getDeck(incoming.id);
        deck = storage.saveDeck({ ...incoming, id: idFree ? incoming.id : utils.generateId() });
      } else if (mode === 'update') {
        storage.saveDeck({ ...incoming, id: deck.id });
      }
      result.deckId = deck.id;

      const existingCards = deck.cardIds.map((id) => storage.getCard(id)).filter(Boolean);

      incoming.cards.forEach((c) => {
        const match = findExistingCard(existingCards, c);
        if (match) {
          if (mode === 'update') {
            storage.saveCard({ ...c, id: match.id }, deck.id);
            result.updated++;
          }
          return;
        }
        // Reuse the file's card id unless another deck already owns it.
        const id = c.id && !library.cards[c.id] ? c.id : utils.generateId();
        const card = storage.saveCard({ ...c, id }, deck.id);
        existingCards.push(card);
        result.added++;
      });
    });

    return result;
  }

  return {
    EXPORT_TYPE,
    FORMAT_VERSION,
    buildExport,
    exportDeck,
    parseImport,
    readFile,
    analyzeImport,
    applyImport,
  };
})();
