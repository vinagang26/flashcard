/* pages/library.js → ui.renderLibrary
 * Language pair bar, deck header, action bar, search/filter and the paginated card list.
 */
(() => {
  const { h } = ui;
  const PAGE_SIZE = 50;

  const STATE_LABELS = { new: 'New', learning: 'Learning', review: 'Review', relearning: 'Relearning' };
  const FILTERS = [
    ['all', 'All cards'],
    ['due', 'Due now'],
    ['new', 'New'],
    ['learning', 'Learning'],
    ['review', 'Review'],
    ['relearning', 'Relearning'],
  ];

  function stateOf(progress) {
    return (progress && progress.state) || 'new';
  }

  function matchesFilter(cardId, filter) {
    const p = app.progress[cardId];
    if (filter === 'all') return true;
    if (filter === 'due') return scheduler.isDue(p);
    return stateOf(p) === filter;
  }

  function matchesQuery(card, query) {
    if (!query) return true;
    return [card.front, card.romanization, card.back]
      .some((text) => utils.foldText(text).includes(query));
  }

  function formatNextReview(progress) {
    if (!progress || progress.state === 'new') return '—';
    if (progress.nextReviewAt <= Date.now()) return 'Due now';
    const due = new Date(progress.nextReviewAt);
    if (due.toDateString() === new Date().toDateString()) return `Today, ${utils.formatTime(progress.nextReviewAt)}`;
    return utils.formatDate(progress.nextReviewAt);
  }

  function createCardRow(card, deck, onRowDelete) {
    const isExisting = Boolean(card && card.id);
    const cardId = isExisting ? card.id : utils.generateId();
    let isSaved = isExisting;

    const progress = isExisting ? app.progress[cardId] : null;
    const state = stateOf(progress);
    const pronLabel = utils.getPronunciationLabel(deck.targetLang);

    const frontInput = h('input', {
      type: 'text',
      class: 'cell-input cell-input-front',
      placeholder: 'Front',
      value: card ? card.front : '',
      lang: utils.getHtmlLang(deck.sourceLang),
      'aria-label': `Front word in ${utils.getLanguageLabel(deck.sourceLang)}`,
    });
    frontInput.setAttribute('spellcheck', 'false');

    const romInput = h('input', {
      type: 'text',
      class: 'cell-input cell-input-rom',
      placeholder: pronLabel,
      value: card ? (card.romanization || '') : '',
      lang: utils.getHtmlLang(deck.targetLang),
      'aria-label': `${pronLabel} in ${utils.getLanguageLabel(deck.targetLang)}`,
    });
    romInput.setAttribute('spellcheck', 'false');

    const backInput = h('input', {
      type: 'text',
      class: 'cell-input cell-input-back',
      placeholder: 'Meaning',
      value: card ? card.back : '',
      lang: utils.getHtmlLang(deck.targetLang),
      'aria-label': `Meaning in ${utils.getLanguageLabel(deck.targetLang)}`,
    });
    backInput.setAttribute('spellcheck', 'false');

    const saveChanges = () => {
      const front = frontInput.value.trim();
      const rom = romInput.value.trim();
      const back = backInput.value.trim();
      if (front || back || rom) {
        storage.saveCard({
          id: cardId,
          front,
          romanization: rom,
          back,
          exampleSentence: (card && card.exampleSentence) || '',
        }, deck.id);
        storage.persist();
        isSaved = true;
      }
    };
    const debouncedSave = utils.debounce(saveChanges, 300);

    frontInput.addEventListener('input', debouncedSave);
    romInput.addEventListener('input', debouncedSave);
    backInput.addEventListener('input', debouncedSave);
    frontInput.addEventListener('blur', saveChanges);
    romInput.addEventListener('blur', saveChanges);
    backInput.addEventListener('blur', saveChanges);

    const kebabBtn = h('button', {
      type: 'button',
      class: 'btn-kebab',
      'aria-label': 'Row actions',
      title: 'Row actions',
    }, '⋮');

    const popover = h('div', { class: 'kebab-popover', hidden: true });
    const deleteBtn = h('button', {
      type: 'button',
      class: 'kebab-menu-item',
      onClick: (e) => {
        e.stopPropagation();
        popover.hidden = true;
        if (onRowDelete) onRowDelete(row, cardId, isSaved);
      },
    }, 'Delete row');
    popover.appendChild(deleteBtn);

    kebabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = popover.hidden;
      document.querySelectorAll('.kebab-popover').forEach((p) => { p.hidden = true; });
      popover.hidden = !willOpen;
    });

    const kebabWrap = h('div', { class: 'kebab-wrap' }, kebabBtn, popover);

    const row = h('tr', { class: 'card-row', 'data-card-id': cardId },
      h('td', { class: 'cell-front-col', 'data-label': 'Front' }, frontInput),
      h('td', { class: 'cell-rom-col', 'data-label': pronLabel }, romInput),
      h('td', { class: 'cell-back-col', 'data-label': 'Meaning' }, backInput),
      h('td', { class: 'cell-state-col', 'data-label': 'State' }, h('span', { class: `state-badge state-${state}` }, STATE_LABELS[state])),
      h('td', { class: 'cell-next', 'data-label': 'Next review' }, formatNextReview(progress)),
      h('td', { class: 'cell-actions' }, kebabWrap),
    );

    return row;
  }

  // Close kebab popovers on outside click or Escape
  document.addEventListener('click', () => {
    document.querySelectorAll('.kebab-popover').forEach((p) => { p.hidden = true; });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.kebab-popover').forEach((p) => { p.hidden = true; });
    }
  });

  /** Card table. Re-rendered on filter/search changes. */
  function renderList(host, deck) {
    const st = ui.libraryState;
    const query = utils.foldText(st.query);

    const sourceLabel = utils.getLanguageLabel(deck.sourceLang);
    const targetLabel = utils.getLanguageLabel(deck.targetLang);
    const pronLabel = utils.getPronunciationLabel(deck.targetLang);

    const onRowDelete = (rowEl, cardId, wasSaved) => {
      rowEl.remove();
      if (wasSaved && cardId) {
        storage.deleteCard(cardId);
        storage.persist();
      }
    };

    const matches = deck.cardIds
      .map((id) => storage.getCard(id))
      .filter((card) => card && matchesFilter(card.id, st.filter) && matchesQuery(card, query));

    const tbody = h('tbody', null, matches.map((c) => createCardRow(c, deck, onRowDelete)));

    const table = h('table', { class: 'card-table' },
      h('thead', null, h('tr', null,
        h('th', { scope: 'col' }, `Front [${sourceLabel}]`),
        h('th', { scope: 'col' }, `${pronLabel} [${targetLabel}]`),
        h('th', { scope: 'col' }, `Meaning [${targetLabel}]`),
        h('th', { scope: 'col' }, 'State'),
        h('th', { scope: 'col' }, 'Next review'),
        h('th', { scope: 'col' }, h('span', { class: 'visually-hidden' }, 'Actions')),
      )),
      tbody,
    );

    const tableWrap = h('div', { class: 'table-wrap' }, table);
    host.replaceChildren(tableWrap);

    // Save reference for appending rows
    ui._currentTbody = tbody;
    ui._currentDeck = deck;
    ui._onRowDelete = onRowDelete;
  }

  let isTableLocked = false;

  function updateTableLock() {
    const tableWrap = document.querySelector('.table-wrap');
    const table = document.querySelector('.card-table');
    const newCardRow = document.querySelector('.new-card-row');
    if (!tableWrap || !table || !newCardRow) return;

    // Viewport height and safety margin (a few rows' height from the bottom edge)
    const viewportHeight = window.innerHeight;
    const buttonHeight = newCardRow.offsetHeight || 50;
    // ~2 rows of margin from the bottom edge of visible screen
    const bottomEdgeMargin = 80;
    const targetBottom = viewportHeight - buttonHeight - bottomEdgeMargin;

    const wrapRect = tableWrap.getBoundingClientRect();
    const maxAllowedHeight = Math.max(160, Math.floor(targetBottom - wrapRect.top));

    // Natural height of table content
    const naturalHeight = table.offsetHeight;

    if (naturalHeight > maxAllowedHeight || isTableLocked) {
      isTableLocked = true;
      tableWrap.style.maxHeight = `${maxAllowedHeight}px`;
      tableWrap.style.overflowY = 'auto';
    } else {
      tableWrap.style.maxHeight = 'none';
      tableWrap.style.overflowY = 'visible';
    }
  }
  window.updateTableLock = updateTableLock;
  window.addEventListener('resize', () => {
    isTableLocked = false;
    updateTableLock();
  });

  ui.renderLibrary = function renderLibrary() {
    const root = document.getElementById('library-content');
    const deck = app.getActiveDeck();
    if (!deck) { app.showScreen('home'); return; }

    const st = ui.libraryState;
    if (st.deckId !== deck.id) {
      isTableLocked = false;
      Object.assign(st, { deckId: deck.id, query: '', filter: 'all', page: 1 });
    }

    const stats = app.getDeckStats(deck.id);

    // 1. Deck header row: [Deck Title] [Search bar] [All cards dropdown] [Export] [Import] [Delete Deck] [Back]
    const listHost = h('div', { class: 'card-list' });
    const searchInput = h('input', {
      id: 'library-search',
      type: 'search',
      class: 'input',
      placeholder: 'Search front, pronunciation, meaning...',
      'aria-label': 'Search cards',
      value: st.query,
      onInput: (e) => { st.query = e.target.value; st.page = 1; renderList(listHost, deck); updateTableLock(); },
    });
    const filterSelect = h('select', {
      id: 'library-filter',
      class: 'select',
      'aria-label': 'Filter by state',
      onChange: (e) => { st.filter = e.target.value; st.page = 1; renderList(listHost, deck); updateTableLock(); },
    }, FILTERS.map(([value, label]) => h('option', { value, selected: value === st.filter }, label)));

    const topRow = h('div', { class: 'library-top-row' },
      h('h1', {
        class: 'deck-title link-btn',
        title: 'Edit deck details',
        tabindex: '0',
        onClick: () => ui.showDeckModal(deck),
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') ui.showDeckModal(deck); },
      }, deck.name),
      searchInput,
      filterSelect,
      h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => app.exportDeckById(deck.id) }, 'Export'),
      h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => app.importDeck() }, 'Import'),
      h('button', { type: 'button', class: 'btn btn-secondary btn-danger-text', onClick: () => app.deleteDeck(deck.id) }, 'Delete Deck'),
      h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => app.showScreen('home') }, '← Back'),
    );

    // 2. Language pair bar (on its own row below topRow)
    const pair = ui.buildLanguagePair({
      source: deck.sourceLang,
      target: deck.targetLang,
      idPrefix: 'library-lp',
      onSourceChange: (code) => app.updateDeckLanguage(deck.id, 'sourceLang', code),
      onTargetChange: (code) => app.updateDeckLanguage(deck.id, 'targetLang', code),
      onSwap: () => app.swapDeckLanguages(deck.id),
    });
    const langBar = h('section', { class: 'lang-bar', 'aria-label': 'Translation direction' },
      pair.el,
      deck.sourceLang === deck.targetLang
        ? h('p', { class: 'field-note', 'data-kind': 'warn' }, 'Source and target language are the same, so auto-translate is off.')
        : null,
    );

    // 3. Directly below card table: a single rectangular "+ New Card" button, centered
    const newCardRow = h('div', { class: 'new-card-row' },
      h('button', {
        type: 'button',
        id: 'btn-new-card',
        class: 'btn btn-primary btn-new-card',
        onClick: () => {
          if (!ui._currentTbody || !ui._currentDeck) return;
          const newRow = createCardRow(null, ui._currentDeck, ui._onRowDelete);
          ui._currentTbody.appendChild(newRow);
          updateTableLock();
          const tableWrap = document.querySelector('.table-wrap');
          if (tableWrap && tableWrap.scrollHeight > tableWrap.clientHeight) {
            tableWrap.scrollTop = tableWrap.scrollHeight;
          }
          const frontInput = newRow.querySelector('.cell-input-front');
          if (frontInput) frontInput.focus({ preventScroll: true });
        },
      }, '+ New Card'),
    );

    // Keep keyboard focus on the same control across a re-render (e.g. after swapping languages).
    const active = document.activeElement;
    const activeId = active && root.contains(active) ? active.id : '';

    root.replaceChildren(topRow, langBar, listHost, newCardRow);
    renderList(listHost, deck);
    requestAnimationFrame(updateTableLock);

    if (activeId) {
      const again = document.getElementById(activeId);
      if (again) again.focus({ preventScroll: true });
    }
  };
})();
