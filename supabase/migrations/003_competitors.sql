-- Competitor intelligence for RingWise / DevOracle coaching

CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  aliases TEXT[] DEFAULT '{}',
  win_points TEXT[] DEFAULT '{}',
  lose_points TEXT[] DEFAULT '{}',
  positioning TEXT NOT NULL,
  trap_questions TEXT[] DEFAULT '{}',
  product TEXT NOT NULL CHECK (product IN ('RingWise', 'DevOracle')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read competitors"
  ON competitors FOR SELECT TO authenticated USING (true);

-- Seed examples (RingWise)
INSERT INTO competitors (name, aliases, win_points, lose_points, positioning, trap_questions, product)
VALUES
  (
    'Gong',
    ARRAY['Gong.io', 'Gong revenue'],
    ARRAY['Real-time talk ratio vs their post-call analytics', 'Deeper CRM embed for SMB teams using RingWise'],
    ARRAY['Mature brand & enterprise procurement', 'Heavy analytics UI can slow rep adoption'],
    'Category-defining revenue intelligence; strong for large sales orgs measuring pipeline truth.',
    ARRAY[
      'How do you reconcile Gong''s forecast with what reps actually did on calls last quarter?',
      'What happens to your coaching workflow if Gong is down for a day?',
      'Where does Gong fall short for live call assist vs post-call review?'
    ],
    'RingWise'
  ),
  (
    'Chorus',
    ARRAY['Chorus.ai', 'ZoomInfo Chorus'],
    ARRAY['RingWise focuses on live guidance; Chorus skews to recorded coaching'],
    ARRAY['Acquired ecosystem; bundling can lock you into broader ZoomInfo spend'],
    'Conversation intelligence tied to ZoomInfo; strong recording and playlist workflows.',
    ARRAY[
      'How much of your stack is locked into ZoomInfo to keep Chorus pricing sane?',
      'When a deal is live on a call, what does Chorus surface in the moment?',
      'What''s your process if Chorus misses a competitor mention entirely?'
    ],
    'RingWise'
  ),
  (
    'Clari',
    ARRAY['Clari Copilot'],
    ARRAY['Forecast-centric; RingWise can differentiate on rep live performance'],
    ARRAY['Copilot features compete on narrative; pricing opaque at enterprise'],
    'Revenue operations and forecasting platform expanding into conversation AI.',
    ARRAY[
      'How does Clari Copilot change rep behavior during the call vs after?',
      'What''s the delta between forecast accuracy and live objection handling?',
      'Where would Clari still leave your newest reps unguided on calls?'
    ],
    'RingWise'
  ),
  (
    'Salesloft',
    ARRAY['Sales Loft', 'Loft'],
    ARRAY['Cadence strength vs our live conversation edge'],
    ARRAY['Bundled AI can feel generic without deep coaching modes'],
    'Sales engagement platform with Rhythm and conversational add-ons for outbound teams.',
    ARRAY[
      'When a prospect brings up a competitor on-call, what does Salesloft surface live?',
      'How do you measure coaching impact beyond email and task completion?',
      'What breaks in your workflow if engagement automation is ahead of call quality?'
    ],
    'RingWise'
  ),
  (
    'HubSpot Sales',
    ARRAY['HubSpot', 'HubSpot Sales Hub', 'Sales Hub'],
    ARRAY['SMB-friendly vs enterprise-grade live coaching depth'],
    ARRAY['All-in-one suite can mean shallower AI depth per workflow'],
    'Inbound growth suite with CRM-native sales engagement and basic conversation tools.',
    ARRAY[
      'At what deal size does HubSpot''s generic guidance fail your team?',
      'How do you coach reps in-the-moment vs relying on CRM notes after?',
      'What competitor intel do you get automatically during a live Zoom?'
    ],
    'RingWise'
  );
