/* pages/home.js → ui.renderHome
 * Deck list with per-deck language pair, plus a due-cards summary across all decks.
 */
(() => {
  const { h } = ui;

  function stat(value, label) {
    return h('div', { class: 'stat' },
      h('span', { class: 'stat-value' }, String(value)),
      h('span', { class: 'stat-label' }, label),
    );
  }

  function deckRow(deck, stats) {
    return h('li', { class: 'deck-row' },
      h('div', { class: 'deck-main' },
        h('h2', { class: 'deck-name' },
          h('button', { type: 'button', class: 'link-btn', onClick: () => app.openDeck(deck.id) }, deck.name)),
        h('span', { class: 'pair-badge' }, ui.languagePairText(deck)),
        deck.description ? h('p', { class: 'deck-desc' }, deck.description) : null,
        h('div', { class: 'deck-counts' },
          h('span', null, utils.pluralize(stats.total, 'card')),
          h('span', { class: stats.due > 0 ? 'is-due' : '' }, `${stats.due} due`),
          stats.new > 0 ? h('span', null, `${stats.new} new`) : null,
        ),
      ),
      h('div', { class: 'deck-actions' },
        h('button', {
          type: 'button',
          class: `btn ${stats.due > 0 ? 'btn-primary' : 'btn-secondary'}`,
          disabled: stats.total === 0,
          onClick: () => app.startReview({ deckId: deck.id }),
        }, stats.due > 0 ? `Review ${stats.due}` : 'Review'),
        h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => app.openDeck(deck.id) }, 'Open'),
      ),
    );
  }

  ui.renderHome = function renderHome() {
    const root = document.getElementById('home-content');
    const decks = app.getSortedDecks();
    const rows = decks.map((deck) => ({ deck, stats: app.getDeckStats(deck.id) }));
    const totalDue = rows.reduce((sum, r) => sum + r.stats.due, 0);
    const totalCards = rows.reduce((sum, r) => sum + r.stats.total, 0);

    const head = h('div', { class: 'page-head' },
      h('h1', { tabindex: '-1' }, 'Your decks'),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => app.importDeck() }, 'Import deck'),
        h('button', { type: 'button', class: 'btn btn-primary', onClick: () => ui.showDeckModal(null) }, 'New deck'),
      ),
    );

    if (decks.length === 0) {
      root.replaceChildren(head, h('div', { class: 'empty-state' },
        h('h2', null, 'Make your first deck'),
        h('p', null, 'Pick the language you’re learning and the language you know. Cardfile translates each new word for you.'),
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn btn-primary', onClick: () => ui.showDeckModal(null) }, 'Create a deck'),
          h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => app.importDeck() }, 'Import a deck file'),
        ),
      ));
      return;
    }

    const statsBar = h('div', { class: 'stats-bar', role: 'group', 'aria-label': 'Summary across all decks' },
      stat(totalDue, totalDue === 1 ? 'card due' : 'cards due'),
      stat(decks.length, decks.length === 1 ? 'deck' : 'decks'),
      stat(totalCards, totalCards === 1 ? 'card' : 'cards'),
      totalDue > 0
        ? h('button', { type: 'button', class: 'btn btn-primary stats-cta', onClick: () => app.startReview({ deckId: null }) }, 'Review all due')
        : null,
    );

    root.replaceChildren(head, statsBar, h('ul', { class: 'deck-list' }, rows.map((r) => deckRow(r.deck, r.stats))));
  };
})();
