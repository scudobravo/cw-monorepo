-- Stripe integration columns on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status     TEXT NOT NULL DEFAULT 'inactive';

-- Index for webhook lookups (by stripe IDs)
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_idx
  ON profiles (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_stripe_sub_idx
  ON profiles (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
