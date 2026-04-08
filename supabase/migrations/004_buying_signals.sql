-- Buying signals logged during live RingWise sessions

CREATE TABLE buying_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  trigger_text TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_buying_signals_session ON buying_signals(session_id);
