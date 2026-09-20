/* utils/helpers.js
 * Dependency-free helpers exposed as the global `utils`.
 */
const utils = (() => {
  /** value = Google Translate language code, label = English name */
  const LANGUAGES = [
    { code: 'zh-CN', label: 'Chinese (Simplified)' },
    { code: 'zh-TW', label: 'Chinese (Traditional)' },
    { code: 'ja',    label: 'Japanese' },
    { code: 'ko',    label: 'Korean' },
    { code: 'vi',    label: 'Vietnamese' },
    { code: 'en',    label: 'English' },
    { code: 'fr',    label: 'French' },
    { code: 'de',    label: 'German' },
    { code: 'es',    label: 'Spanish' },
    { code: 'pt',    label: 'Portuguese' },
    { code: 'ru',    label: 'Russian' },
    { code: 'ar',    label: 'Arabic' },
    { code: 'hi',    label: 'Hindi' },
    { code: 'th',    label: 'Thai' },
    { code: 'id',    label: 'Indonesian' },
  ];

  const ROMANIZATION_LANGS = ['zh-CN', 'zh-TW', 'ja', 'ko', 'ar', 'hi', 'th'];

  const ROMANIZATION_LABELS = {
    'zh-CN': 'Pinyin',
    'zh-TW': 'Pinyin',
    ja: 'Romaji',
    ko: 'Romanization',
    ar: 'Transliteration',
    hi: 'Transliteration',
    th: 'Romanization',
  };

  /** Value for the HTML `lang` attribute (helps browsers pick the right CJK glyphs). */
  const HTML_LANG = { 'zh-CN': 'zh-Hans', 'zh-TW': 'zh-Hant' };

  function needsRomanization(langCode) {
    return ROMANIZATION_LANGS.includes(langCode);
  }

  function getRomanizationLabel(langCode) {
    return ROMANIZATION_LABELS[langCode] || 'Romanization';
  }

  /**
   * Label for the pronunciation/romanization field.
   * Returns the language-specific name (Pinyin, Romaji, etc.) when one exists,
   * otherwise returns the generic "Pronunciation" — used for all languages (v0.2 back-field split).
   */
  function getPronunciationLabel(langCode) {
    return ROMANIZATION_LABELS[langCode] || 'Pronunciation';
  }

  function isSupportedLanguage(code) {
    return LANGUAGES.some((l) => l.code === code);
  }

  /** Falls back to the raw code so unknown languages from imported files still display. */
  function getLanguageLabel(code) {
    const found = LANGUAGES.find((l) => l.code === code);
    return found ? found.label : code || '';
  }

  function getHtmlLang(code) {
    return HTML_LANG[code] || code || 'en';
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // randomUUID is unavailable on insecure origins such as file://
    return (
      'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 6)
    );
  }

  /** Local midnight (ms) for today. */
  function todayTimestamp() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  /** Local midnight (ms), `days` days from today. Uses calendar math so DST changes don't drift. */
  function addDaysToToday(days, now = Date.now()) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d.getTime();
  }

  function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  /** `front` and `back` are required. `romanization` and `exampleSentence` are optional. */
  function validateCard(card) {
    const errors = {};
    if (!card || !String(card.front || '').trim()) {
      errors.front = 'Enter the word or phrase you want to learn.';
    }
    if (!card || !String(card.back || '').trim()) {
      errors.back = 'Enter the translation.';
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  function findCardById(library, cardId) {
    return (library && library.cards && library.cards[cardId]) || null;
  }

  /** Lowercased, trimmed, Unicode-normalised text for comparisons and search. */
  function normalizeText(value) {
    return String(value == null ? '' : value).normalize('NFC').trim().toLowerCase();
  }

  /**
   * For searching: like normalizeText, but also ignores accents and tone marks,
   * so "xuexi" finds "xuéxí" and "qua tao" finds "quả táo".
   */
  function foldText(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'd')
      .toLowerCase()
      .trim();
  }

  function debounce(fn, wait) {
    let timer = null;
    const debounced = (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
    debounced.cancel = () => clearTimeout(timer);
    return debounced;
  }

  function shuffle(array) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural || singular + 's'}`;
  }

  return {
    LANGUAGES,
    needsRomanization,
    getRomanizationLabel,
    getPronunciationLabel,
    isSupportedLanguage,
    getLanguageLabel,
    getHtmlLang,
    generateId,
    todayTimestamp,
    addDaysToToday,
    formatDate,
    formatTime,
    validateCard,
    findCardById,
    normalizeText,
    foldText,
    debounce,
    shuffle,
    pluralize,
  };
})();
