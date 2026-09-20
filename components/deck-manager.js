/* components/deck-manager.js → ui.showDeckModal(existingDeck | null)
 * Name, description, author and the source ⇄ target language pair.
 */
(() => {
  const { h } = ui;

  ui.showDeckModal = function showDeckModal(existingDeck) {
    const isEdit = Boolean(existingDeck);

    const nameInput = h('input', {
      id: 'deck-name', class: 'input', type: 'text', required: true, autocomplete: 'off',
      value: isEdit ? existingDeck.name : '', 'aria-describedby': 'deck-name-error',
    });
    const nameError = h('p', { id: 'deck-name-error', class: 'field-error', hidden: true }, 'Enter a deck name.');
    const descInput = h('input', {
      id: 'deck-desc', class: 'input', type: 'text', autocomplete: 'off',
      value: isEdit ? existingDeck.description : '',
    });
    const authorInput = h('input', {
      id: 'deck-author', class: 'input', type: 'text', autocomplete: 'off',
      value: isEdit ? existingDeck.author : '',
    });

    // Defaults: English → Vietnamese. In this modal, ⇄ only swaps the two dropdown values;
    // they're saved with the deck.
    const pair = ui.buildLanguagePair({
      source: isEdit ? existingDeck.sourceLang : 'en',
      target: isEdit ? existingDeck.targetLang : 'vi',
      idPrefix: 'deck-lp',
      onSourceChange: updateSameLanguageNote,
      onTargetChange: updateSameLanguageNote,
      onSwap: updateSameLanguageNote,
    });

    const sameNote = h('p', { class: 'field-note', 'data-kind': 'warn', hidden: true },
      'Source and target language are the same, so auto-translate will be off.');

    function updateSameLanguageNote() {
      const { sourceLang, targetLang } = pair.getValue();
      sameNote.hidden = sourceLang !== targetLang;
    }
    updateSameLanguageNote();

    function save() {
      const name = nameInput.value.trim();
      nameError.hidden = Boolean(name);
      nameInput.setAttribute('aria-invalid', name ? 'false' : 'true');
      if (!name) { nameInput.focus(); return; }

      const { sourceLang, targetLang } = pair.getValue();
      const ok = app.saveDeck({
        id: isEdit ? existingDeck.id : undefined,
        name,
        description: descInput.value,
        author: authorInput.value,
        sourceLang,
        targetLang,
      });
      if (ok) ui.closeModal();
    }

    const form = h('form', { class: 'modal-inner', novalidate: true, 'aria-labelledby': 'deck-modal-title',
      onSubmit: (e) => { e.preventDefault(); save(); } },
      h('h2', { id: 'deck-modal-title', class: 'modal-title' }, isEdit ? 'Edit deck' : 'New deck'),

      h('div', { class: 'field' },
        h('label', { for: 'deck-name' }, 'Deck name'), nameInput, nameError),
      h('div', { class: 'field' },
        h('label', { for: 'deck-desc' }, 'Description (optional)'), descInput),
      h('div', { class: 'field' },
        h('label', { for: 'deck-author' }, 'Author (optional)'), authorInput),

      h('fieldset', { class: 'field fieldset' },
        h('legend', null, 'Language pair'),
        h('p', { class: 'field-hint' }, 'You learn the source language. Cardfile translates it into the target language.'),
        pair.el, sameNote),

      h('div', { class: 'modal-actions' },
        !isEdit
          ? h('button', { type: 'button', class: 'btn btn-ghost modal-actions-start', onClick: () => { ui.closeModal(); app.importDeck(); } }, 'Import Deck')
          : null,
        h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => ui.closeModal() }, 'Cancel'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save Deck'),
      ),
    );

    ui.openModal(form);
    nameInput.focus();
  };
})();
