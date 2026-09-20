/* core/scheduler.js
 * SM-2 spaced repetition with Anki-style learning steps (global `scheduler`).
 * Language-agnostic: it only ever sees progress objects, never card content.
 *
 * Progress shape (stored in localStorage "vocab_progress", keyed by card id):
 *   state          'new' | 'learning' | 'review' | 'relearning'
 *   step           index into the current learning steps
 *   easeFactor     SM-2 ease (default 2.5, never below 1.3)
 *   interval       current interval in days (review cards)
 *   repetition     successful reviews in a row
 *   lapses         number of times a review card was answered "Again"
 *   nextReviewAt   timestamp (ms). Minute-precise while learning, local midnight for review cards.
 *   lastReviewedAt timestamp (ms) or null
 *   reviewCount    total reviews
 */
const scheduler = (() => {
  const RATING = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };
  const RATING_NAMES = { again: 1, hard: 2, good: 3, easy: 4 };

  const CONFIG = {
    learningSteps: [1, 10],      // minutes, for new cards
    relearningSteps: [10],       // minutes, after a lapse
    graduatingInterval: 1,       // days, "Good" on the last learning step
    easyInterval: 4,             // days, "Easy" on a learning card
    startingEase: 2.5,
    minEase: 1.3,
    hardFactor: 1.2,
    easyBonus: 1.3,
    easeDelta: { again: -0.2, hard: -0.15, easy: 0.15 },
    lapseInterval: 1,            // days, interval a card resumes with after relearning
    maxInterval: 36500,          // days
  };

  const MINUTE = 60 * 1000;

  function initCard() {
    return {
      state: 'new',
      step: 0,
      easeFactor: CONFIG.startingEase,
      interval: 0,
      repetition: 0,
      lapses: 0,
      nextReviewAt: 0,
      lastReviewedAt: null,
      reviewCount: 0,
    };
  }

  function toRating(rating) {
    const value = typeof rating === 'string' ? RATING_NAMES[rating.toLowerCase()] : rating;
    if (![1, 2, 3, 4].includes(value)) throw new Error(`Invalid rating: ${rating}`);
    return value;
  }

  const clampEase = (ease) => Math.max(CONFIG.minEase, Math.round(ease * 100) / 100);
  const clampInterval = (days) => Math.min(CONFIG.maxInterval, Math.max(1, Math.round(days)));

  /* ---------- learning / relearning ---------- */

  function stepDelayMinutes(steps, step, rating) {
    if (rating === RATING.HARD && step === 0 && steps.length > 1) {
      return (steps[0] + steps[1]) / 2;       // Anki: halfway between the first two steps
    }
    return steps[step];
  }

  function graduate(card, intervalDays, now) {
    card.state = 'review';
    card.step = 0;
    card.interval = clampInterval(intervalDays);
    card.repetition = (card.repetition || 0) + 1;
    card.nextReviewAt = utils.addDaysToToday(card.interval, now);
    return card;
  }

  function learningCard(card, rating, now) {
    const relearning = card.state === 'relearning';
    const steps = relearning ? CONFIG.relearningSteps : CONFIG.learningSteps;
    card.state = relearning ? 'relearning' : 'learning';
    const step = Math.min(Math.max(card.step || 0, 0), steps.length - 1);

    const stayOnStep = (index) => {
      card.step = index;
      card.nextReviewAt = now + stepDelayMinutes(steps, index, rating) * MINUTE;
      return card;
    };

    switch (rating) {
      case RATING.AGAIN:
        return stayOnStep(0);
      case RATING.HARD:
        return stayOnStep(step);
      case RATING.GOOD:
        if (step + 1 < steps.length) return stayOnStep(step + 1);
        return graduate(card, relearning ? Math.max(card.interval, CONFIG.lapseInterval) : CONFIG.graduatingInterval, now);
      default: // EASY
        return graduate(card, relearning ? Math.max(card.interval, CONFIG.lapseInterval) + 1 : CONFIG.easyInterval, now);
    }
  }

  /* ---------- review ---------- */

  function reviewCard(card, rating, now) {
    const ease = card.easeFactor;
    const iv = Math.max(card.interval, 1);

    if (rating === RATING.AGAIN) {
      card.lapses += 1;
      card.easeFactor = clampEase(ease + CONFIG.easeDelta.again);
      card.state = 'relearning';
      card.step = 0;
      card.repetition = 0;
      card.interval = CONFIG.lapseInterval;
      card.nextReviewAt = now + CONFIG.relearningSteps[0] * MINUTE;
      return card;
    }

    // Hard < Good < Easy is always strictly increasing, even for tiny intervals.
    const hard = Math.max(iv + 1, Math.round(iv * CONFIG.hardFactor));
    const good = Math.max(hard + 1, Math.round(iv * ease));
    const easy = Math.max(good + 1, Math.round(iv * ease * CONFIG.easyBonus));

    if (rating === RATING.HARD) {
      card.easeFactor = clampEase(ease + CONFIG.easeDelta.hard);
      card.interval = clampInterval(hard);
    } else if (rating === RATING.GOOD) {
      card.interval = clampInterval(good);
    } else {
      card.easeFactor = clampEase(ease + CONFIG.easeDelta.easy);
      card.interval = clampInterval(easy);
    }
    card.repetition += 1;
    card.nextReviewAt = utils.addDaysToToday(card.interval, now);
    return card;
  }

  /**
   * Returns a NEW progress object; the input is never mutated.
   * `rating` is 1-4 or 'again' | 'hard' | 'good' | 'easy'.
   */
  function processReview(progress, rating, now = Date.now()) {
    const r = toRating(rating);
    const card = Object.assign(initCard(), progress);
    card.reviewCount += 1;
    card.lastReviewedAt = now;
    return card.state === 'review' ? reviewCard(card, r, now) : learningCard(card, r, now);
  }

  function isDue(progress, now = Date.now()) {
    if (!progress || progress.state === 'new') return true;
    return progress.nextReviewAt <= now;
  }

  /* ---------- interval previews for the rating buttons ---------- */

  function formatMinutes(minutes) {
    if (minutes <= 1) return '<1m';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    return `${Math.round(minutes / 60)}h`;
  }

  function formatDays(days) {
    if (days < 31) return `${days}d`;
    if (days < 365) return `${(days / 30).toFixed(1).replace(/\.0$/, '')}mo`;
    return `${(days / 365).toFixed(1).replace(/\.0$/, '')}y`;
  }

  function describeNext(next, now) {
    return next.state === 'review'
      ? formatDays(next.interval)
      : formatMinutes((next.nextReviewAt - now) / MINUTE);
  }

  /** → { again: '<1m', hard: '6m', good: '10m', easy: '4d' } for a card's progress. */
  function getIntervalPreviews(progress, now = Date.now()) {
    const base = progress || initCard();
    return {
      again: describeNext(processReview(base, RATING.AGAIN, now), now),
      hard: describeNext(processReview(base, RATING.HARD, now), now),
      good: describeNext(processReview(base, RATING.GOOD, now), now),
      easy: describeNext(processReview(base, RATING.EASY, now), now),
    };
  }

  return { RATING, CONFIG, initCard, processReview, getIntervalPreviews, isDue };
})();
