/**
 * SuperMemo SM-2 spaced repetition.
 * quality: 0–2 = failed, 3 = hard, 4 = good, 5 = easy (full scale 0–5).
 */

export type Sm2Quality = 0 | 1 | 2 | 3 | 4 | 5;

export interface Sm2CardState {
  interval_days: number;
  easiness_factor: number;
  repetitions: number;
}

export interface Sm2Result extends Sm2CardState {
  last_quality: Sm2Quality;
  next_review: Date;
}

export function sm2(card: Sm2CardState, quality: Sm2Quality): Sm2Result {
  const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  let easiness_factor = Math.round((card.easiness_factor + efDelta) * 100) / 100;
  if (easiness_factor < 1.3) easiness_factor = 1.3;

  let repetitions = card.repetitions;
  let interval_days = card.interval_days;

  if (quality < 3) {
    repetitions = 0;
    interval_days = 1;
  } else {
    const prevRep = card.repetitions;
    if (prevRep === 0) {
      interval_days = 1;
    } else if (prevRep === 1) {
      interval_days = 6;
    } else {
      interval_days = Math.max(
        1,
        Math.round(card.interval_days * easiness_factor),
      );
    }
    repetitions = prevRep + 1;
  }

  const next_review = new Date();
  next_review.setUTCDate(next_review.getUTCDate() + interval_days);

  return {
    interval_days,
    easiness_factor,
    repetitions,
    last_quality: quality,
    next_review,
  };
}
