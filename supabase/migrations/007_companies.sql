-- DO-6 — Company-specific interview prep (DevOracle)
-- (005 is already used in this repo; file name per task → use 007.)

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  interview_style TEXT NOT NULL,
  common_topics TEXT[] DEFAULT '{}',
  red_flags TEXT[] DEFAULT '{}',
  system_prompt_addon TEXT,
  logo_emoji TEXT DEFAULT '🏢',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies readable by authenticated"
  ON companies FOR SELECT TO authenticated
  USING (true);

INSERT INTO companies (name, slug, interview_style, common_topics, red_flags, system_prompt_addon, logo_emoji)
VALUES
(
  'Google',
  'google',
  'Emphasis on scalability, clarity of thought, and rigorous complexity analysis.',
  ARRAY['scalability', 'clean code', 'Big-O analysis', 'distributed systems', 'maps & sets'],
  ARRAY['hand-wavy complexity', 'jumping to code without plan', 'ignoring edge cases'],
  'The candidate is preparing specifically for Google-style interviews. Prioritize: (1) clear communication of approach before details; (2) scalability and trade-offs; (3) clean, readable solution structure; (4) explicit time and space complexity with tight Big-O reasoning; (5) testing and edge cases. Keep suggestions concise and interview-realistic.',
  '🔍'
),
(
  'Meta',
  'meta',
  'Fast iteration, product sense, and strong coding under time pressure; behavioral answers use structured narratives.',
  ARRAY['product sense', 'coding speed', 'graphs', 'STAR stories', 'A/B trade-offs'],
  ARRAY['unstructured behavioral rambling', 'coding without clarifying constraints', 'ignoring product impact'],
  'The candidate targets Meta. Blend product judgment with implementation: connect solutions to user impact, move quickly but verbalize trade-offs. For behavioral prompts, nudge toward STAR (Situation, Task, Action, Result) with metrics when possible. For coding, favor practical efficiency and clean APIs.',
  '📱'
),
(
  'Amazon',
  'amazon',
  'Leadership Principles (LPs) are central; every strong answer ties to a named LP.',
  ARRAY['Leadership Principles', 'ownership', 'customer obsession', 'bar raiser mindset', 'metrics'],
  ARRAY['generic answers without LP', 'blaming others', 'vague impact'],
  'Amazon interview context: whenever relevant, explicitly tie guidance to one or more Leadership Principles (e.g. Customer Obsession, Ownership, Dive Deep, Bias for Action). Behavioral answers should reference a specific LP by name. For system/coding questions, frame trade-offs in terms of customer impact and operational excellence.',
  '📦'
),
(
  'Apple',
  'apple',
  'Pixel-level craft, simplicity, and design thinking applied even to technical problems.',
  ARRAY['attention to detail', 'UX of APIs', 'simplicity', 'performance on device', 'privacy'],
  ARRAY['over-engineering', 'cluttered interfaces', 'hand-waving on user experience'],
  'Apple-style prep: stress craftsmanship, simplicity, and user-visible quality. Prefer minimal, elegant approaches; call out details that affect UX or performance on real devices. When discussing design or code, connect choices to clarity and delight.',
  '🍎'
),
(
  'Microsoft',
  'microsoft',
  'Collaborative problem solving, clarity in large-system context, and Azure/cloud awareness when relevant.',
  ARRAY['collaboration', 'Azure', 'enterprise patterns', 'reliability', 'inclusive design'],
  ARRAY['solo-hero answers', 'ignoring operability', 'dismissing accessibility'],
  'Microsoft interview tone: emphasize collaboration, inclusive communication, and how solutions fit enterprise-scale reliability and security. When cloud or platforms matter, show awareness of Azure-style services conceptually (without inventing false specifics).',
  '🪟'
),
(
  'Netflix',
  'netflix',
  'Senior judgment, ambiguity navigation, and culture of freedom & responsibility.',
  ARRAY['judgment', 'culture add', 'high autonomy scenarios', 'trade-offs under ambiguity'],
  ARRAY['needing perfect data before acting', 'micromanager mindset'],
  'Netflix context: favor senior-level judgment calls. Use "what would you do if…" framing when helpful; stress independence, candid feedback, and business-aware engineering. Avoid bureaucratic or process-heavy phrasing in suggestions.',
  '🎬'
),
(
  'Stripe',
  'stripe',
  'API design, correctness, idempotency, and distributed systems in fintech settings.',
  ARRAY['API design', 'idempotency', 'payments', 'reliability', 'consistency models'],
  ARRAY['unsafe money movement', 'hand-waving on consistency', 'ignoring fraud/abuse'],
  'Stripe-style interviews: prioritize robust API design, idempotency, clear error models, and distributed consistency trade-offs relevant to payments. Hints should feel production-grade and safety-conscious.',
  '💳'
),
(
  'Airbnb',
  'airbnb',
  'Full-stack thinking, product sense, and alignment with company values.',
  ARRAY['full-stack', 'trust & safety', 'marketplace dynamics', 'inclusion', 'craft'],
  ARRAY['purely technical answers with zero product sense', 'ignoring two-sided marketplace effects'],
  'Airbnb prep: connect engineering choices to trust, community, and marketplace dynamics. Balance backend and product thinking; reference craft and inclusive experiences when relevant.',
  '🏠'
)
ON CONFLICT (slug) DO NOTHING;
