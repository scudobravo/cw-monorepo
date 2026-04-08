-- ═══════════════════════════════════════════════════════════
-- Savant — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'team'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ── Sessions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product             TEXT NOT NULL,   -- 'DevOracle' | 'RingWise'
  mode                TEXT NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at            TIMESTAMPTZ,
  duration_secs       INT,
  total_suggestions   INT NOT NULL DEFAULT 0,
  cache_hits          INT NOT NULL DEFAULT 0,
  tokens_used         INT NOT NULL DEFAULT 0
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can write sessions"
  ON sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── Question Bank ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product         TEXT NOT NULL,
  mode            TEXT NOT NULL,
  text            TEXT NOT NULL,
  embedding       VECTOR(768),
  answer          TEXT NOT NULL,
  suggestion_type TEXT NOT NULL DEFAULT 'hint',
  asked_count     INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS questions_embedding_idx
  ON questions USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for filtering by product + mode
CREATE INDEX IF NOT EXISTS questions_product_mode_idx
  ON questions (product, mode);

-- Questions are global (shared across all users), readable by all authenticated users
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read questions"
  ON questions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can write questions"
  ON questions FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── RPC: Semantic search ──────────────────────────────────────
CREATE OR REPLACE FUNCTION match_questions(
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count     INT,
  p_product       TEXT,
  p_mode          TEXT
)
RETURNS TABLE (
  id              UUID,
  product         TEXT,
  mode            TEXT,
  text            TEXT,
  answer          TEXT,
  suggestion_type TEXT,
  asked_count     INT,
  created_at      TIMESTAMPTZ,
  similarity      FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.product,
    q.mode,
    q.text,
    q.answer,
    q.suggestion_type,
    q.asked_count,
    q.created_at,
    1 - (q.embedding <=> query_embedding) AS similarity
  FROM questions q
  WHERE
    q.product = p_product
    AND q.mode = p_mode
    AND 1 - (q.embedding <=> query_embedding) > match_threshold
  ORDER BY q.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── RPC: Increment asked_count ────────────────────────────────
CREATE OR REPLACE FUNCTION increment_question_count(question_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE questions
  SET asked_count = asked_count + 1,
      updated_at  = now()
  WHERE id = question_id;
END;
$$;
