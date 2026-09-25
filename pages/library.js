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

  function cardRow(card, sourceLang, targetLang) {
    const progress = app.progress[card.id];
    const state = stateOf(progress);
    const pronLabel = utils.getPronunciationLabel(targetLang);
    return h('tr', { class: 'card-row' },
      h('td', { class: 'cell-front', 'data-label': 'Front', lang: utils.getHtmlLang(sourceLang) }, card.front),
      h('td', { class: 'cell-rom', 'data-label': pronLabel }, card.romanization || '—'),
      h('td', { class: 'cell-back', 'data-label': 'Meaning', lang: utils.getHtmlLang(targetLang) }, card.back),
      h('td', { 'data-label': 'State' }, h('span', { class: `state-badge state-${state}` }, STATE_LABELS[state])),
      h('td', { class: 'cell-next', 'data-label': 'Next review' }, formatNextReview(progress)),
      h('td', { class: 'cell-actions' },
        h('button', { type: 'button', class: 'btn btn-small btn-ghost', 'aria-label': `Edit ${card.front}`, onClick: () => app.openCardModal(card.id) }, 'Edit'),
        h('button', { type: 'button', class: 'btn btn-small btn-ghost', 'aria-label': `Practice ${card.front}`, onClick: () => app.startReview({ deckId: card.deckId, cardIds: [card.id] }) }, 'Practice'),
        h('button', { type: 'button', class: 'btn btn-small btn-ghost btn-danger-text', 'aria-label': `Delete ${card.front}`, onClick: () => app.deleteCard(card.id) }, 'Delete'),
      ),
    );
  }

  /** Card table + pagination. Re-rendered on its own so the search box keeps focus while typing. */
  function renderList(host, deck) {
    const st = ui.libraryState;
    const query = utils.foldText(st.query);

    const sourceLabel = utils.getLanguageLabel(deck.sourceLang);
    const targetLabel = utils.getLanguageLabel(deck.targetLang);

    if (deck.cardIds.length === 0) {
      const emptyTable = h('table', { class: 'card-table' },
        h('thead', null, h('tr', null,
          h('th', { scope: 'col' }, `Front [${sourceLabel}]`),
          h('th', { scope: 'col' }, utils.getPronunciationLabel(deck.targetLang)),
          h('th', { scope: 'col' }, `Meaning [${targetLabel}]`),
          h('th', { scope: 'col' }, 'State'),
          h('th', { scope: 'col' }, 'Next review'),
          h('th', { scope: 'col' }, h('span', { class: 'visually-hidden' }, 'Actions')),
        )),
        h('tbody', null),
      );
      host.replaceChildren(h('div', { class: 'table-wrap' }, emptyTable));
      return;
    }

    // Newest cards first.
    const matches = deck.cardIds.slice().reverse()
      .filter((id) => matchesFilter(id, st.filter))
      .map((id) => storage.getCard(id))
      .filter((card) => card && matchesQuery(card, query));

    if (matches.length === 0) {
      host.replaceChildren(h('div', { class: 'empty-state' },
        h('h2', null, 'No cards match'),
        h('p', null, 'Try a different search or filter.'),
      ));
      return;
    }

    const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    st.page = Math.min(Math.max(1, st.page), pageCount);
    const start = (st.page - 1) * PAGE_SIZE;
    const pageCards = matches.slice(start, start + PAGE_SIZE);

    const table = h('table', { class: 'card-table' },
      h('thead', null, h('tr', null,
        h('th', { scope: 'col' }, `Front [${sourceLabel}]`),
        h('th', { scope: 'col' }, utils.getPronunciationLabel(deck.targetLang)),
        h('th', { scope: 'col' }, `Meaning [${targetLabel}]`),
        h('th', { scope: 'col' }, 'State'),
        h('th', { scope: 'col' }, 'Next review'),
        h('th', { scope: 'col' }, h('span', { class: 'visually-hidden' }, 'Actions')),
      )),
      h('tbody', null, pageCards.map((c) => cardRow(c, deck.sourceLang, deck.targetLang))),
    );

    const goTo = (page) => { st.page = page; renderList(host, deck); host.scrollIntoView({ block: 'start' }); };
    const pager = h('div', { class: 'pager' },
      h('span', { class: 'pager-info', 'aria-live': 'polite' },
        `Showing ${start + 1}–${start + pageCards.length} of ${matches.length}`),
      pageCount > 1 ? h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn btn-small btn-secondary', disabled: st.page <= 1, onClick: () => goTo(st.page - 1) }, 'Previous'),
        h('span', { class: 'pager-page' }, `Page ${st.page} of ${pageCount}`),
        h('button', { type: 'button', class: 'btn btn-small btn-secondary', disabled: st.page >= pageCount, onClick: () => goTo(st.page + 1) }, 'Next'),
      ) : null,
    );

    host.replaceChildren(h('div', { class: 'table-wrap' }, table), pager);
  }

  ui.renderLibrary = function renderLibrary() {
    const root = document.getElementById('library-content');
    const deck = app.getActiveDeck();
    if (!deck) { app.showScreen('home'); return; }

    const st = ui.libraryState;
    if (st.deckId !== deck.id) Object.assign(st, { deckId: deck.id, query: '', filter: 'all', page: 1 });

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
      onInput: (e) => { st.query = e.target.value; st.page = 1; renderList(listHost, deck); },
    });
    const filterSelect = h('select', {
      id: 'library-filter',
      class: 'select',
      'aria-label': 'Filter by state',
      onChange: (e) => { st.filter = e.target.value; st.page = 1; renderList(listHost, deck); },
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
        onClick: () => app.openCardModal(null),
      }, '+ New Card'),
    );

    // Keep keyboard focus on the same control across a re-render (e.g. after swapping languages).
    const active = document.activeElement;
    const activeId = active && root.contains(active) ? active.id : '';

    root.replaceChildren(topRow, langBar, listHost, newCardRow);
    renderList(listHost, deck);

    if (activeId) {
      const again = document.getElementById(activeId);
      if (again) again.focus({ preventScroll: true });
    }
  };
})();
