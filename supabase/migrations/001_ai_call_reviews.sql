-- AI Call Reviews table
-- Stores structured AI analysis of coaching call transcripts
CREATE TABLE IF NOT EXISTS ai_call_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_log_id UUID NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id),

  -- Summary
  summary TEXT NOT NULL,

  -- Client Progress Tracking
  goals_mentioned JSONB DEFAULT '[]',          -- [{goal, status, notes}]
  commitments_tracked JSONB DEFAULT '[]',      -- [{commitment, followed_through: bool, notes}]
  progress_score INTEGER CHECK (progress_score BETWEEN 1 AND 10),
  progress_notes TEXT,

  -- Coaching Quality
  question_types JSONB DEFAULT '[]',           -- [{type, example, effectiveness}]
  rapport_indicators JSONB DEFAULT '[]',       -- [{indicator, observation}]
  techniques_used JSONB DEFAULT '[]',          -- [{technique, context, effectiveness}]
  coaching_quality_score INTEGER CHECK (coaching_quality_score BETWEEN 1 AND 10),
  coaching_quality_notes TEXT,

  -- Action Items (AI-extracted)
  extracted_action_items JSONB DEFAULT '[]',   -- [{title, description, suggested_due_date, priority}]

  -- Sentiment & Engagement
  client_sentiment TEXT CHECK (client_sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative')),
  engagement_score INTEGER CHECK (engagement_score BETWEEN 1 AND 10),
  engagement_notes TEXT,

  -- Key moments / highlights
  key_moments JSONB DEFAULT '[]',             -- [{timestamp_or_section, description, significance}]

  -- Overall
  overall_assessment TEXT,
  recommendations_for_coach TEXT,

  -- Metadata
  model_used TEXT DEFAULT 'gemini-3-flash',
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_ai_call_reviews_call_log ON ai_call_reviews(call_log_id);
CREATE INDEX idx_ai_call_reviews_client ON ai_call_reviews(client_id);
CREATE INDEX idx_ai_call_reviews_coach ON ai_call_reviews(coach_id);

-- Only one review per call
CREATE UNIQUE INDEX idx_ai_call_reviews_unique_call ON ai_call_reviews(call_log_id);

-- RLS policies
ALTER TABLE ai_call_reviews ENABLE ROW LEVEL SECURITY;

-- Coaches can see reviews for their clients
CREATE POLICY "Coaches can view their client reviews"
  ON ai_call_reviews FOR SELECT
  USING (coach_id = auth.uid());

-- Clients can see their own reviews
CREATE POLICY "Clients can view own reviews"
  ON ai_call_reviews FOR SELECT
  USING (client_id IN (
    SELECT id FROM clients WHERE user_id = auth.uid()
  ));

-- Only service role (edge function) can insert/update
CREATE POLICY "Service role can insert reviews"
  ON ai_call_reviews FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update reviews"
  ON ai_call_reviews FOR UPDATE
  USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_review_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_call_reviews_updated
  BEFORE UPDATE ON ai_call_reviews
  FOR EACH ROW EXECUTE FUNCTION update_ai_review_timestamp();
