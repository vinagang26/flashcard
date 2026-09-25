/* pages/review.js → ui.renderReview(total, pos, card, revealed, deck)
 * Front → [Show answer] → back + romanization + four rating buttons with interval previews.
 * Keyboard: Space/Enter reveals (and answers "Good"), 1–4 rate Again/Hard/Good/Easy.
 */
(() => {
  const { h } = ui;

  const RATINGS = [
    { key: 'again', label: 'Again', shortcut: '1' },
    { key: 'hard', label: 'Hard', shortcut: '2' },
    { key: 'good', label: 'Good', shortcut: '3' },
    { key: 'easy', label: 'Easy', shortcut: '4' },
  ];

  function emptyState(total) {
    const s = app.session;
    const deckId = s ? s.deckId : null;
    const finished = total > 0;
    return h('div', { class: 'empty-state review-empty' },
      h('h2', { tabindex: '-1' }, finished ? 'Session complete' : 'No cards due'),
      h('p', null, finished
        ? `You went through ${utils.pluralize(total, 'card')}${s && !s.practice ? ' and your schedule is up to date' : ''}.`
        : 'Nothing is scheduled for review right now. Practice the whole deck if you want extra repetition.'),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn btn-secondary', 'data-autofocus': '', onClick: () => app.startReview({ deckId, practice: true }) }, 'Practice All'),
        h('button', { type: 'button', class: 'btn btn-primary', onClick: () => app.goHome() }, 'Go Home'),
      ),
    );
  }

  ui.renderReview = function renderReview(total, pos, card, revealed, deck) {
    const root = document.getElementById('review-content');
    const s = app.session;

    const topbar = h('div', { class: 'review-top' },
      h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => app.exitReview() }, '← Exit'),
      card
        ? h('div', { class: 'review-progress' },
            h('span', { 'aria-live': 'polite' }, `Card ${pos} of ${total}`),
            h('div', { class: 'progress-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(Math.max(0, pos - 1)), 'aria-label': 'Session progress' },
              h('div', { class: 'progress-fill', style: `width:${total ? ((pos - 1) / total) * 100 : 0}%` })),
          )
        : null,
    );

    if (!card) {
      root.replaceChildren(topbar, emptyState(total));
      focusPrimary(root);
      return;
    }

    const sourceLang = deck ? deck.sourceLang : 'en';
    const targetLang = deck ? deck.targetLang : 'en';
    const sourceLabel = utils.getLanguageLabel(sourceLang);
    const targetLabel = utils.getLanguageLabel(targetLang);
    const example = card.exampleSentence
      ? h('p', { class: 'fc-example', lang: utils.getHtmlLang(sourceLang) }, card.exampleSentence)
      : null;

    let face;
    if (!revealed) {
      face = [
        h('p', { class: 'fc-front', lang: utils.getHtmlLang(sourceLang) }, card.front),
        h('p', { class: 'fc-lang' }, sourceLabel),
        example,
      ];
    } else {
      const pronLabel = utils.getPronunciationLabel(targetLang);
      const pronSection = h('div', { class: 'fc-subfield fc-subfield-pron' },
        h('span', { class: 'fc-subfield-label' }, `${pronLabel} [${targetLabel}]`),
        h('p', { class: 'fc-rom', lang: utils.getHtmlLang(targetLang) }, card.romanization || '—'),
      );
      const meaningSection = h('div', { class: 'fc-subfield fc-subfield-meaning' },
        h('span', { class: 'fc-subfield-label' }, `Meaning [${targetLabel}]`),
        h('p', { class: 'fc-back', lang: utils.getHtmlLang(targetLang) }, card.back),
      );
      const backSplit = h('div', { class: 'fc-back-split' }, pronSection, meaningSection);

      face = [
        h('p', { class: 'fc-front fc-front-small', lang: utils.getHtmlLang(sourceLang) }, card.front),
        h('hr', { class: 'fc-divider' }),
        backSplit,
        example,
      ];
    }

    let controls;
    if (!revealed) {
      controls = h('div', { class: 'review-controls' },
        h('button', { type: 'button', class: 'btn btn-primary btn-large', 'data-autofocus': '', onClick: () => app.revealCard() }, 'Show answer'),
      );
    } else {
      const previews = s && s.practice ? null : scheduler.getIntervalPreviews(app.getCardProgress(card.id));
      controls = h('div', { class: 'review-controls' },
        h('div', { class: 'rating-grid' }, RATINGS.map((r) =>
          h('button', {
            type: 'button',
            class: `rating-btn rating-${r.key}`,
            'aria-label': previews ? `${r.label}, next review in ${previews[r.key]}` : r.label,
            'aria-keyshortcuts': r.shortcut,
            'data-autofocus': r.key === 'good' ? '' : null,
            onClick: () => app.submitRating(r.key),
          },
            h('span', { class: 'rating-label' }, r.label),
            previews ? h('span', { class: 'rating-interval' }, previews[r.key]) : null,
          ))),
        h('p', { class: 'shortcut-hint' }, 'Press 1–4 to answer.'),
      );
    }

    // replaceChildren() stringifies null as "null", so only pass real nodes.
    root.replaceChildren(...[
      topbar,
      s && s.practice ? h('p', { class: 'practice-note' }, 'Practice mode: your answers here don’t change your review schedule.') : null,
      h('article', { class: `flashcard${revealed ? ' is-revealed' : ''}`, 'aria-label': revealed ? 'Card back' : 'Card front' }, face),
      controls,
    ].filter(Boolean));
    focusPrimary(root);

    // If revealed card is missing pronunciation, fetch it on the fly and update DOM (for romanized languages only).
    if (revealed && !card.romanization && card.back && utils.needsRomanization(targetLang)) {
      app.fetchPronunciation(card.back, targetLang).then((rom) => {
        if (rom && card && !card.romanization) {
          card.romanization = rom;
          storage.persist();
          const romEl = root.querySelector('.fc-rom');
          if (romEl) {
            romEl.textContent = rom;
            romEl.hidden = false;
          }
        }
      });
    }
  };

  /** Keep keyboard flow going after each re-render. */
  function focusPrimary(root) {
    const el = root.querySelector('[data-autofocus]');
    if (el) el.focus({ preventScroll: true });
  }

  /* ---------- keyboard shortcuts ---------- */

  document.addEventListener('keydown', (e) => {
    if (app.screen !== 'review' || !app.session) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (ui.els.dialog && ui.els.dialog.open) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    const s = app.session;
    if (!s.queue.length) return;

    const ratingIndex = ['1', '2', '3', '4'].indexOf(e.key);
    if (ratingIndex !== -1 && s.revealed) {
      e.preventDefault();
      app.submitRating(RATINGS[ratingIndex].key);
      return;
    }

    // Space/Enter on a focused button already "clicks" it; only handle them when nothing is focused.
    if ((e.key === ' ' || e.key === 'Enter') && tag !== 'BUTTON') {
      e.preventDefault();
      if (s.revealed) app.submitRating('good');
      else app.revealCard();
    }
  });
})();
