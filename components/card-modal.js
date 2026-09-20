/* components/card-modal.js — ui.showCardModal(existingCard | null, deck)
 * Fields adapt to the deck's language pair. Typing in the front field (debounced 400 ms)
 * fills the back (and pronunciation/romanization for all languages that support auto-fill).
 *
 * Back-field split (v0.2): the pronunciation field is ALWAYS shown for every language.
 *   - For CJK/Arabic/Hindi/Thai: label is language-specific (Pinyin, Romaji, etc.)
 *   - For all other languages: label is "Pronunciation"
 *   - The field is never hidden and romanization is never cleared on save.
 */
(() => {
  const { h } = ui;
  const AUTOFILL_DELAY_MS = 400;

  ui.showCardModal = function showCardModal(existingCard, deck) {
    const isEdit = Boolean(existingCard);
    const decks = app.library.decks;
    let currentDeck = deck;

    /* ---------- fields ---------- */

    const frontLabel = h('label', { for: 'card-front' });
    const frontInput = h('input', {
      id: 'card-front', class: 'input input-face', type: 'text', autocomplete: 'off',
      value: isEdit ? existingCard.front : '',
      'aria-describedby': 'card-front-error auto-fill-note',
    });
    frontInput.setAttribute('spellcheck', 'false');
    const spinner = h('span', { id: 'auto-fill-indicator', class: 'auto-fill-indicator', hidden: true, role: 'status' },
      h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Translating…');
    const frontError = h('p', { id: 'card-front-error', class: 'field-error', hidden: true });
    const autoFillNote = h('p', { id: 'auto-fill-note', class: 'field-note', 'data-kind': 'warn', hidden: true });

    // Pronunciation field — always visible for all languages (back-field split, v0.2).
    const romLabel = h('label', { for: 'card-rom' });
    const romInput = h('input', {
      id: 'card-rom', class: 'input', type: 'text', autocomplete: 'off',
      value: isEdit ? existingCard.romanization : '',
    });
    romInput.setAttribute('spellcheck', 'false');
    const romHint = h('p', { class: 'field-hint' }, 'Phonetic transcription. Filled in automatically for supported languages — edit if wrong.');
    const romField = h('div', { class: 'field', id: 'card-rom-field' }, romLabel, romInput, romHint);

    const backLabel = h('label', { for: 'card-back' });
    const backInput = h('input', {
      id: 'card-back', class: 'input input-face', type: 'text', autocomplete: 'off',
      value: isEdit ? existingCard.back : '', 'aria-describedby': 'card-back-error',
    });
    const backError = h('p', { id: 'card-back-error', class: 'field-error', hidden: true });

    const exampleInput = h('textarea', {
      id: 'card-example', class: 'input', rows: 2,
      value: isEdit ? existingCard.exampleSentence : '',
    });
    const exampleLabel = h('label', { for: 'card-example' });

    /* ---------- deck selector (only when there is a choice) ---------- */

    let deckSelect = null;
    if (decks.length > 1) {
      deckSelect = h('select', { id: 'card-deck', class: 'select' },
        decks.map((d) => h('option', { value: d.id, selected: d.id === deck.id }, `${d.name} (${ui.languagePairText(d)})`)));
      deckSelect.addEventListener('change', () => {
        currentDeck = decks.find((d) => d.id === deckSelect.value) || currentDeck;
        ui.cardModalContext.deck = currentDeck;
        refreshFields();
        if (frontInput.value.trim()) app.triggerAutoFill(frontInput.value);
      });
    }

    /** Labels and fields adapt to the deck's languages. */
    function refreshFields() {
      const sourceLabel = utils.getLanguageLabel(currentDeck.sourceLang);
      const targetLabel = utils.getLanguageLabel(currentDeck.targetLang);
      const pronLabel = utils.getPronunciationLabel(currentDeck.targetLang);

      frontLabel.textContent = `Front [${sourceLabel}]`;
      backLabel.textContent = `Meaning [${targetLabel}]`;
      romLabel.textContent = `${pronLabel} [${targetLabel}]`;
      exampleLabel.textContent = `Example sentence [${sourceLabel}] (optional)`;

      frontInput.lang = utils.getHtmlLang(currentDeck.sourceLang);
      backInput.lang = utils.getHtmlLang(currentDeck.targetLang);
      romInput.lang = utils.getHtmlLang(currentDeck.targetLang);
      exampleInput.lang = utils.getHtmlLang(currentDeck.sourceLang);

      ui.setAutoFillNote(
        currentDeck.sourceLang === currentDeck.targetLang ? 'Source and target language are the same.' : '',
        'warn',
      );
    }

    /* ---------- auto-fill wiring ---------- */

    ui.cardModalContext = { deck: currentDeck, frontEl: frontInput, backEl: backInput, romanizationEl: romInput };

    const debouncedFill = utils.debounce((value) => app.triggerAutoFill(value), AUTOFILL_DELAY_MS);
    let composing = false;   // don't translate half-typed IME text (pinyin, kana…)
    frontInput.addEventListener('compositionstart', () => { composing = true; });
    frontInput.addEventListener('compositionend', () => { composing = false; debouncedFill(frontInput.value); });
    frontInput.addEventListener('input', (e) => {
      if (composing || e.isComposing) return;
      debouncedFill(frontInput.value);
    });

    /* ---------- save ---------- */

    function save() {
      // Pronunciation is always saved — never cleared — regardless of source language.
      const data = {
        id: isEdit ? existingCard.id : undefined,
        front: frontInput.value,
        romanization: romInput.value,   // always kept; was previously cleared for non-ROMANIZATION_LANGS
        back: backInput.value,
        exampleSentence: exampleInput.value,
      };
      const { valid, errors } = utils.validateCard(data);

      [[frontInput, frontError, errors.front], [backInput, backError, errors.back]].forEach(([input, el, message]) => {
        el.textContent = message || '';
        el.hidden = !message;
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
      });
      if (!valid) {
        (errors.front ? frontInput : backInput).focus();
        return;
      }
      debouncedFill.cancel();
      if (app.saveCard(data, currentDeck.id)) ui.closeModal();
    }

    /* ---------- layout ---------- */

    const form = h('form', { class: 'modal-inner', novalidate: true, 'aria-labelledby': 'card-modal-title',
      onSubmit: (e) => { e.preventDefault(); save(); } },
      h('h2', { id: 'card-modal-title', class: 'modal-title' }, isEdit ? 'Edit card' : 'New card'),

      deckSelect ? h('div', { class: 'field' }, h('label', { for: 'card-deck' }, 'Deck'), deckSelect) : null,

      h('div', { class: 'field' },
        h('div', { class: 'label-row' }, frontLabel, spinner),
        frontInput, frontError, autoFillNote),
      h('div', { class: 'field' }, backLabel, backInput, backError),
      romField,    // pronunciation — below back (meaning first, pronunciation below)
      h('div', { class: 'field' }, exampleLabel, exampleInput),

      h('div', { class: 'modal-actions' },
        h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => ui.closeModal() }, 'Cancel'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save Card'),
      ),
    );

    ui.openModal(form);
    refreshFields();          // after opening: it also writes to #auto-fill-note, which must be in the DOM
    frontInput.focus();
  };
})();