/* components/import-modal.js → ui.showImportConflictModal(analysis)
 * Shown when an imported deck matches an existing one (same id, or same name).
 * `analysis` comes from deckPortability.analyzeImport().
 * The choice is passed to app.handleImportResolution('update' | 'merge' | 'replace' | 'cancel').
 */
(() => {
  const { h } = ui;

  ui.showImportConflictModal = function showImportConflictModal(analysis) {
    const { incoming, existing, matchedBy, newCards, overlappingCards } = analysis;
    const existingCount = existing.cardIds.length;

    const options = [
      {
        value: 'merge',
        title: 'Merge',
        text: newCards > 0
          ? `Add the ${utils.pluralize(newCards, 'new card')} and leave everything already in the deck untouched.`
          : 'Every card in the file is already in the deck, so nothing would change.',
      },
      {
        value: 'update',
        title: 'Update',
        text: `Overwrite the ${utils.pluralize(overlappingCards, 'matching card')} and the deck details with the file’s version, and add the ${utils.pluralize(newCards, 'new card')}. Review progress is kept.`,
      },
      {
        value: 'replace',
        title: 'Replace',
        text: `Delete the existing deck, its ${utils.pluralize(existingCount, 'card')} and all review progress, then import the file as a fresh deck.`,
        danger: true,
      },
    ];

    let selected = 'merge';
    const radios = options.map((opt) => {
      const input = h('input', {
        type: 'radio', name: 'import-resolution', value: opt.value, checked: opt.value === selected,
        onChange: () => { selected = opt.value; },
      });
      return h('label', { class: `choice${opt.danger ? ' choice-danger' : ''}` },
        input,
        h('span', { class: 'choice-body' },
          h('span', { class: 'choice-title' }, opt.title),
          h('span', { class: 'choice-text' }, opt.text)),
      );
    });

    const reason = matchedBy === 'id'
      ? 'This file is another copy of a deck you already have.'
      : 'You already have a deck with this name.';

    const form = h('form', { class: 'modal-inner', 'aria-labelledby': 'import-title',
      onSubmit: (e) => { e.preventDefault(); app.handleImportResolution(selected); } },
      h('h2', { id: 'import-title', class: 'modal-title' }, `“${incoming.name}” already exists`),
      h('p', { class: 'modal-text' },
        `${reason} The file has ${utils.pluralize(incoming.cards.length, 'card')}; your deck has ${utils.pluralize(existingCount, 'card')}.`),
      h('fieldset', { class: 'fieldset choice-list' },
        h('legend', { class: 'visually-hidden' }, 'What should happen to the existing deck?'),
        radios),
      h('div', { class: 'modal-actions' },
        h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => app.handleImportResolution('cancel') }, 'Cancel'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Import deck'),
      ),
    );

    ui.openModal(form);
    const first = form.querySelector('input[type="radio"]');
    if (first) first.focus();
  };

  // Closing the dialog with Esc or a backdrop click cancels the import.
  document.addEventListener('DOMContentLoaded', () => {
    const dialog = document.getElementById('modal');
    if (!dialog) return;
    dialog.addEventListener('close', () => {
      if (app.pendingImport) app.pendingImport = null;
    });
  });
})();
