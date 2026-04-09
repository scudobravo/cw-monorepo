-- ── Pricing v2: product-specific plans, Interview Pass support ───

-- Add product column to plans (NULL = system plan, not purchasable)
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS product TEXT;

-- Remove old generic plans, insert product-specific ones
DELETE FROM plans WHERE id IN ('free', 'pro', 'team');

INSERT INTO plans (id, display_name, tokens_monthly, price_eur, product, features) VALUES
  -- System plan (for cancelled/downgraded users — not publicly sold)
  ('free', 'Free', 0, 0, NULL,
   '[]'),

  -- DevOracle plans
  ('pro', 'Pro', 500000, 17, 'DevOracle',
   '["~500 sessioni/mese","AI coaching real-time","Storico sessioni","Supporto prioritario"]'),

  -- Interview Pass: token limit is N/A (time-based), stored as 0
  ('interview_pass', 'Interview Pass', 0, 9.90, 'DevOracle',
   '["1 colloquio","Fino a 2 ore di utilizzo","Valido 30 giorni"]'),

  -- RingWise plans
  ('ringwise_pro', 'Pro', 2000000, 29, 'RingWise',
   '["Uso illimitato","AI coaching real-time","Follow-up email AI","Supporto prioritario"]'),

  ('ringwise_team', 'Team', 5000000, 69, 'RingWise',
   '["Tutto il piano Pro","5 posti","Analytics team","Prompt personalizzati"]')

ON CONFLICT (id) DO UPDATE SET
  display_name   = EXCLUDED.display_name,
  tokens_monthly = EXCLUDED.tokens_monthly,
  price_eur      = EXCLUDED.price_eur,
  product        = EXCLUDED.product,
  features       = EXCLUDED.features;

-- ── Interview Pass columns on profiles ───────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pass_expires_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pass_minutes_used  INTEGER NOT NULL DEFAULT 0;

-- ── RPC: atomically increment pass_minutes_used ──────────────────
CREATE OR REPLACE FUNCTION increment_pass_minutes(p_user_id UUID, p_minutes INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET pass_minutes_used = pass_minutes_used + p_minutes
  WHERE id = p_user_id;
END;
$$;

-- ── Update sync_tokens_limit trigger to skip interview_pass ──────
-- (interview_pass has no monthly token limit — it's time-based)
CREATE OR REPLACE FUNCTION sync_tokens_limit_from_plan()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    -- interview_pass is time-based: don't touch tokens_limit
    IF NEW.plan = 'interview_pass' THEN
      RETURN NEW;
    END IF;
    SELECT tokens_monthly INTO v_limit FROM plans WHERE id = NEW.plan;
    IF v_limit IS NOT NULL THEN
      NEW.tokens_limit  := v_limit;
      NEW.tokens_used   := 0;
      NEW.usage_reset_at := date_trunc('month', now()) + interval '1 month';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Migrate existing pro/team users to new plan IDs where possible
-- (safe: if product = 'RingWise' and plan = 'pro', remap to 'ringwise_pro')
UPDATE profiles SET plan = 'ringwise_pro'  WHERE plan = 'pro'  AND product = 'RingWise';
UPDATE profiles SET plan = 'ringwise_team' WHERE plan = 'team' AND product = 'RingWise';
-- DevOracle 'pro' stays as 'pro'; 'team' had no DevOracle users
UPDATE profiles SET plan = 'free' WHERE plan = 'team' AND product = 'DevOracle';
