-- INFRA-2 — Sessions persistence (DevOracle / RingWise)
-- Apply after 001_initial.sql

-- Legacy columns from initial schema
ALTER TABLE sessions DROP COLUMN IF EXISTS cache_hits;
ALTER TABLE sessions DROP COLUMN IF EXISTS tokens_used;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS talk_ratio_user NUMERIC(5,2);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS recap TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scorecard JSONB;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE sessions SET created_at = COALESCE(started_at, now()) WHERE created_at IS NULL;

UPDATE sessions SET product = 'DevOracle' WHERE product = 'DevOracle';
UPDATE sessions SET product = 'RingWise' WHERE product = 'RingWise';

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_product_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_product_check
  CHECK (product IN ('DevOracle', 'RingWise'));

DROP POLICY IF EXISTS "Users can read own sessions" ON sessions;
DROP POLICY IF EXISTS "Service role can write sessions" ON sessions;
DROP POLICY IF EXISTS "users see own sessions" ON sessions;

CREATE POLICY "users see own sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_product_idx ON sessions(product);
