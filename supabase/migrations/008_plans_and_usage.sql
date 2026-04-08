-- ── Plans table (configurable limits per tier) ──────────────────
CREATE TABLE IF NOT EXISTS plans (
  id             TEXT PRIMARY KEY,
  display_name   TEXT NOT NULL,
  tokens_monthly INTEGER NOT NULL,
  price_eur      NUMERIC(8,2) NOT NULL DEFAULT 0,
  features       JSONB NOT NULL DEFAULT '[]'
);

INSERT INTO plans (id, display_name, tokens_monthly, price_eur, features) VALUES
  ('free', 'Free',  150000,  0,  '["~50 sessioni/mese","AI coaching real-time","Storico sessioni"]'),
  ('pro',  'Pro',   1500000, 19, '["~500 sessioni/mese","Tutte le funzionalità","Supporto prioritario"]'),
  ('team', 'Team',  5000000, 49, '["~1600 sessioni/mese","Analytics team","Prompt personalizzati"]')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans readable by authenticated" ON plans;
CREATE POLICY "plans readable by authenticated"
  ON plans FOR SELECT TO authenticated USING (true);

-- ── Usage columns on profiles (if not already added) ─────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tokens_limit    INTEGER NOT NULL DEFAULT 150000,
  ADD COLUMN IF NOT EXISTS tokens_used     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_reset_at  TIMESTAMPTZ NOT NULL DEFAULT
    date_trunc('month', now()) + interval '1 month';

-- ── Atomic increment RPC (called by backend UsageService) ────────
CREATE OR REPLACE FUNCTION increment_tokens_used(p_user_id UUID, p_tokens INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET tokens_used = tokens_used + p_tokens
  WHERE id = p_user_id;
END;
$$;

-- ── Trigger: auto-set tokens_limit from plans when plan changes ──
CREATE OR REPLACE FUNCTION sync_tokens_limit_from_plan()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    SELECT tokens_monthly INTO v_limit FROM plans WHERE id = NEW.plan;
    IF v_limit IS NOT NULL THEN
      NEW.tokens_limit := v_limit;
      NEW.tokens_used  := 0;
      NEW.usage_reset_at := date_trunc('month', now()) + interval '1 month';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tokens_limit ON profiles;
CREATE TRIGGER trg_sync_tokens_limit
  BEFORE UPDATE OF plan ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_tokens_limit_from_plan();
