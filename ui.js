/* ui.js
 * Screen + modal coordinator (global `ui`).
 * Pages and components attach their renderers to this object:
 *   pages/home.js → ui.renderHome      pages/library.js → ui.renderLibrary
 *   pages/review.js → ui.renderReview  components/*.js → ui.showDeckModal, ui.showCardModal,
 *                                                        ui.showImportConflictModal
 *
 * All DOM is built with ui.h() (textContent, never innerHTML), so deck content
 * from imported files can't inject markup.
 */
const ui = {
  els: {},
  screens: ['home', 'library', 'review'],
  libraryState: { deckId: null, query: '', filter: 'all', page: 1 },
  cardModalContext: null,   // set by ui.showCardModal, read by app.triggerAutoFill

  init() {
    this.els = {
      dialog: document.getElementById('modal'),
      modalBody: document.getElementById('modal-body'),
      toast: document.getElementById('toast'),
    };
    this.screens.forEach((name) => {
      this.els[name] = document.getElementById(`screen-${name}`);
    });

    const dialog = this.els.dialog;
    let pressStartedOnBackdrop = false;
    dialog.addEventListener('pointerdown', (e) => { pressStartedOnBackdrop = e.target === dialog; });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog && pressStartedOnBackdrop) this.closeModal();
    });
    dialog.addEventListener('close', () => {
      if (dialog.open) return;   // a new modal was opened before this event fired
      this.els.modalBody.replaceChildren();
      this.cardModalContext = null;
      app.cancelAutoFill();
      if (this._confirmResolve) this._settleConfirm(false);
    });
  },

  /* ---------- tiny hyperscript helper ---------- */

  /** ui.h('button', { class: 'btn', onClick: fn }, 'Save') */
  h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((key) => {
        const value = props[key];
        if (value == null || value === false) return;
        if (key === 'class') el.className = value;
        else if (key === 'style') el.setAttribute('style', value);
        else if (key === 'for') el.setAttribute('for', value);
        else if (key.length > 2 && key.startsWith('on') && typeof value === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key in el && !key.includes('-')) el[key] = value;
        else el.setAttribute(key, value === true ? '' : value);
      });
    }
    const append = (child) => {
      if (child == null || child === false) return;
      if (Array.isArray(child)) child.forEach(append);
      else el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    };
    children.forEach(append);
    return el;
  },

  /* ---------- screens ---------- */

  showScreen(name) {
    this.screens.forEach((s) => { this.els[s].hidden = s !== name; });
  },

  /** Re-renders whichever screen is currently visible. */
  render() {
    const screen = app.screen;
    if (screen === 'home') this.renderHome();
    else if (screen === 'library') this.renderLibrary();
    else if (screen === 'review') app.refreshReview();
  },

  /* ---------- toast ---------- */

  toast(message, kind = 'info', duration = 3200) {
    const el = this.els.toast;
    el.textContent = message;
    el.dataset.kind = kind;
    // Popover puts the toast in the top layer so it also shows above an open modal.
    try { if (el.showPopover && !el.matches(':popover-open')) el.showPopover(); } catch (_) { /* unsupported */ }
    requestAnimationFrame(() => el.classList.add('is-visible'));
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => {
        if (!el.classList.contains('is-visible')) {
          try { if (el.hidePopover && el.matches(':popover-open')) el.hidePopover(); } catch (_) { /* ignore */ }
        }
      }, 250);
    }, kind === 'error' ? 6000 : duration);
  },

  /* ---------- modal ---------- */

  openModal(content) {
    this.els.modalBody.replaceChildren(content);
    if (!this.els.dialog.open) this.els.dialog.showModal();
  },

  closeModal() {
    if (this.els.dialog.open) this.els.dialog.close();
  },

  /** → Promise<boolean> */
  confirm({ title, message, confirmLabel = 'Confirm', danger = false }) {
    const { h } = this;
    return new Promise((resolve) => {
      this._confirmResolve = resolve;
      const content = h('div', { class: 'modal-inner', role: 'alertdialog', 'aria-labelledby': 'confirm-title' },
        h('h2', { id: 'confirm-title', class: 'modal-title' }, title),
        h('p', { class: 'modal-text' }, message),
        h('div', { class: 'modal-actions' },
          h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => this._settleConfirm(false) }, 'Cancel'),
          h('button', { type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onClick: () => this._settleConfirm(true) }, confirmLabel),
        ),
      );
      this.openModal(content);
      const cancelBtn = content.querySelector('.btn-ghost');
      if (cancelBtn) cancelBtn.focus();
    });
  },

  _settleConfirm(result) {
    const resolve = this._confirmResolve;
    this._confirmResolve = null;
    if (resolve) resolve(result);
    this.closeModal();
  },

  /* ---------- auto-fill feedback (used by the card modal) ---------- */

  showAutoFillLoading(isLoading) {
    const el = document.getElementById('auto-fill-indicator');
    if (el) el.hidden = !isLoading;
  },

  /** Inline message under the front field. kind: 'warn' | 'info'. Pass '' to clear. */
  setAutoFillNote(text, kind = 'warn') {
    const el = document.getElementById('auto-fill-note');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
    el.dataset.kind = kind;
  },

  /* ---------- shared: language pair selector ---------- */

  /**
   * [ Source ▼ ]  ⇄  [ Target ▼ ]
   * Callbacks are optional. The deck modal only reads values on save; the library bar
   * passes callbacks that persist each change immediately.
   * → { el, sourceSelect, targetSelect, getValue() }
   */
  buildLanguagePair({ source, target, idPrefix = 'lp', onSourceChange, onTargetChange, onSwap } = {}) {
    const { h } = this;
    const extraCodes = [source, target].filter((c) => c && !utils.isSupportedLanguage(c));

    const makeSelect = (id, label, value) => {
      const select = h('select', { id, class: 'select', 'aria-label': label });
      utils.LANGUAGES.concat(extraCodes.map((code) => ({ code, label: code })))
        .forEach((lang) => {
          select.appendChild(h('option', { value: lang.code, selected: lang.code === value }, lang.label));
        });
      return select;
    };

    const sourceSelect = makeSelect(`${idPrefix}-source`, 'Source language', source);
    const targetSelect = makeSelect(`${idPrefix}-target`, 'Target language', target);

    sourceSelect.addEventListener('change', () => onSourceChange && onSourceChange(sourceSelect.value));
    targetSelect.addEventListener('change', () => onTargetChange && onTargetChange(targetSelect.value));

    const swapBtn = h('button', {
      id: `${idPrefix}-swap`,
      type: 'button',
      class: 'swap-btn',
      'aria-label': 'Swap source and target languages',
      title: 'Swap languages',
      onClick: () => {
        const s = sourceSelect.value;
        sourceSelect.value = targetSelect.value;
        targetSelect.value = s;
        if (onSwap) onSwap({ sourceLang: sourceSelect.value, targetLang: targetSelect.value });
      },
    }, '⇄');

    const el = h('div', { class: 'lang-pair' },
      h('div', { class: 'lang-pair-field' },
        h('label', { for: sourceSelect.id, class: 'lang-pair-label' }, 'Source language'), sourceSelect),
      swapBtn,
      h('div', { class: 'lang-pair-field' },
        h('label', { for: targetSelect.id, class: 'lang-pair-label' }, 'Target language'), targetSelect),
    );

    return {
      el,
      sourceSelect,
      targetSelect,
      getValue: () => ({ sourceLang: sourceSelect.value, targetLang: targetSelect.value }),
    };
  },

  /** "English → Vietnamese" */
  languagePairText(deck) {
    return `${utils.getLanguageLabel(deck.sourceLang)} → ${utils.getLanguageLabel(deck.targetLang)}`;
  },
};
