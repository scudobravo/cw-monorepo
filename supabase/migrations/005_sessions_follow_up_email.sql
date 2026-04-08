-- Follow-up email draft (JSON: subject, body, generated_at)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS follow_up_email JSONB;
