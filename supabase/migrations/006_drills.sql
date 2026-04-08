-- DO-5 — Spaced repetition drill cards (SM-2) for DevOracle
-- Note: 004/005 already used; this is the drill migration.

CREATE TABLE IF NOT EXISTS drill_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  next_review TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  interval_days INTEGER NOT NULL DEFAULT 1,
  easiness_factor NUMERIC(4,2) NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0,
  last_quality INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, question_id)
);

ALTER TABLE drill_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own drill cards"
  ON drill_cards
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS drill_cards_next_review_idx
  ON drill_cards (user_id, next_review);

-- Streak / last study day (updated by backend on each review)
CREATE TABLE IF NOT EXISTS drill_user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE drill_user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own drill stats"
  ON drill_user_stats
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
