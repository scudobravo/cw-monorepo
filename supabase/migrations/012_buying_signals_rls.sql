-- Security hardening for public.buying_signals
-- Resolves Supabase Security Advisor warnings:
-- - RLS Disabled in Public
-- - Sensitive Columns Exposed

ALTER TABLE buying_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role can manage buying_signals" ON buying_signals;
CREATE POLICY "service role can manage buying_signals"
  ON buying_signals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "users can read own buying_signals" ON buying_signals;
CREATE POLICY "users can read own buying_signals"
  ON buying_signals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM sessions
      WHERE sessions.id = buying_signals.session_id
        AND sessions.user_id = auth.uid()
    )
  );
