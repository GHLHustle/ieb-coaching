-- ============================================================
-- IEB Coaching - Full Database Schema
-- Run this in your new Supabase project SQL Editor
-- ============================================================

-- ========================
-- 1. PROFILES (extends auth.users)
-- ========================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL CHECK (role IN ('coach', 'client')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ========================
-- 2. CLIENTS
-- ========================
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  email VARCHAR,
  phone VARCHAR,
  business_name VARCHAR,
  ghl_contact_id VARCHAR,
  google_drive_url VARCHAR,
  is_active BOOLEAN DEFAULT true,
  stage VARCHAR,
  start_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated column for convenience
ALTER TABLE clients ADD COLUMN IF NOT EXISTS full_name TEXT
  GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED;

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage their clients"
  ON clients FOR ALL USING (coach_id = auth.uid());

CREATE POLICY "Clients can view own record"
  ON clients FOR SELECT USING (user_id = auth.uid());

-- ========================
-- 3. COACH SETTINGS
-- ========================
CREATE TABLE IF NOT EXISTS coach_settings (
  coach_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  ghl_api_key VARCHAR,
  ghl_location_id VARCHAR,
  ghl_subaccount_id VARCHAR,
  google_calendar_url VARCHAR,
  timezone VARCHAR DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE coach_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage own settings"
  ON coach_settings FOR ALL USING (coach_id = auth.uid());

-- ========================
-- 4. CONFIDENCE CHECK-INS
-- ========================
CREATE TABLE IF NOT EXISTS confidence_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  services_score INTEGER CHECK (services_score BETWEEN 0 AND 10),
  operations_score INTEGER CHECK (operations_score BETWEEN 0 AND 10),
  growth_score INTEGER CHECK (growth_score BETWEEN 0 AND 10),
  notes TEXT,
  week_start_date DATE NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, week_start_date)
);

ALTER TABLE confidence_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view client checkins"
  ON confidence_checkins FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid()));

CREATE POLICY "Clients can manage own checkins"
  ON confidence_checkins FOR ALL
  USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- ========================
-- 5. BLUEPRINT TEMPLATES
-- ========================
CREATE TABLE IF NOT EXISTS blueprint_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE blueprint_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage own templates"
  ON blueprint_templates FOR ALL USING (created_by = auth.uid());

-- ========================
-- 6. MILESTONES
-- ========================
CREATE TABLE IF NOT EXISTS milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  template_id UUID REFERENCES blueprint_templates(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  description TEXT,
  division VARCHAR NOT NULL CHECK (division IN ('services', 'operations', 'growth')),
  due_date DATE,
  status VARCHAR DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'complete')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage milestones for their clients"
  ON milestones FOR ALL
  USING (
    client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
    OR template_id IN (SELECT id FROM blueprint_templates WHERE created_by = auth.uid())
  );

CREATE POLICY "Clients can view own milestones"
  ON milestones FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- ========================
-- 7. CALL LOGS
-- ========================
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id),
  call_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,
  summary TEXT,
  transcript TEXT,
  notes TEXT,
  call_type VARCHAR DEFAULT 'coaching',
  google_doc_url VARCHAR,
  meet_url VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage their call logs"
  ON call_logs FOR ALL USING (coach_id = auth.uid());

CREATE POLICY "Clients can view own call logs"
  ON call_logs FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- ========================
-- 8. ACTION ITEMS
-- ========================
CREATE TABLE IF NOT EXISTS action_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id),
  call_log_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,
  title VARCHAR NOT NULL,
  description TEXT,
  division VARCHAR CHECK (division IN ('services', 'operations', 'growth')),
  due_date DATE,
  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'complete')),
  completed_at TIMESTAMPTZ,
  is_visible_to_client BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage action items"
  ON action_items FOR ALL USING (coach_id = auth.uid());

CREATE POLICY "Clients can view visible action items"
  ON action_items FOR SELECT
  USING (
    is_visible_to_client = true
    AND client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

-- ========================
-- 9. NOTES
-- ========================
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage their notes"
  ON notes FOR ALL USING (coach_id = auth.uid());

CREATE POLICY "Clients can view shared notes"
  ON notes FOR SELECT
  USING (
    is_shared = true
    AND client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

-- ========================
-- 10. GHL MESSAGES
-- ========================
CREATE TABLE IF NOT EXISTS ghl_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR DEFAULT 'sms' CHECK (message_type IN ('sms', 'email')),
  send_type VARCHAR DEFAULT 'manual' CHECK (send_type IN ('manual', 'automated')),
  ghl_contact_id VARCHAR,
  ghl_status VARCHAR DEFAULT 'queued' CHECK (ghl_status IN ('queued', 'sent', 'failed', 'no_ghl_id')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ghl_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage messages for their clients"
  ON ghl_messages FOR ALL
  USING (client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid()));

-- ========================
-- 11. INTAKE RESPONSES
-- ========================
CREATE TABLE IF NOT EXISTS intake_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id),
  business_stage VARCHAR,
  years_in_business INTEGER,
  revenue_current NUMERIC,
  revenue_target NUMERIC,
  biggest_challenge TEXT,
  services_description TEXT,
  team_size INTEGER,
  goals_90_day TEXT,
  goals_1_year TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE intake_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage intake responses"
  ON intake_responses FOR ALL USING (coach_id = auth.uid());

CREATE POLICY "Clients can manage own intake"
  ON intake_responses FOR ALL
  USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- ========================
-- 12. MESSAGE TEMPLATES
-- ========================
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  content TEXT NOT NULL,
  division_tag VARCHAR CHECK (division_tag IN ('services', 'operations', 'growth')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage own message templates"
  ON message_templates FOR ALL USING (coach_id = auth.uid());

-- ========================
-- 13. RESOURCES
-- ========================
CREATE TABLE IF NOT EXISTS resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  description TEXT,
  division VARCHAR NOT NULL CHECK (division IN ('services', 'operations', 'growth')),
  resource_type VARCHAR DEFAULT 'link' CHECK (resource_type IN ('link', 'document', 'video', 'template', 'checklist')),
  url VARCHAR,
  sort_order INTEGER DEFAULT 0,
  is_visible_to_clients BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage own resources"
  ON resources FOR ALL USING (coach_id = auth.uid());

CREATE POLICY "Clients can view visible resources"
  ON resources FOR SELECT
  USING (
    is_visible_to_clients = true
    AND coach_id IN (SELECT coach_id FROM clients WHERE user_id = auth.uid())
  );

-- ========================
-- 14. SESSION TEMPLATES
-- ========================
CREATE TABLE IF NOT EXISTS session_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_type VARCHAR,
  agenda_items JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0
);

ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view session templates"
  ON session_templates FOR SELECT USING (auth.uid() IS NOT NULL);

-- ========================
-- 15. AI CALL REVIEWS
-- ========================
CREATE TABLE IF NOT EXISTS ai_call_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_log_id UUID NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id),
  summary TEXT NOT NULL,
  goals_mentioned JSONB DEFAULT '[]',
  commitments_tracked JSONB DEFAULT '[]',
  progress_score INTEGER CHECK (progress_score BETWEEN 1 AND 10),
  progress_notes TEXT,
  question_types JSONB DEFAULT '[]',
  rapport_indicators JSONB DEFAULT '[]',
  techniques_used JSONB DEFAULT '[]',
  coaching_quality_score INTEGER CHECK (coaching_quality_score BETWEEN 1 AND 10),
  coaching_quality_notes TEXT,
  extracted_action_items JSONB DEFAULT '[]',
  client_sentiment TEXT CHECK (client_sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative')),
  engagement_score INTEGER CHECK (engagement_score BETWEEN 1 AND 10),
  engagement_notes TEXT,
  key_moments JSONB DEFAULT '[]',
  overall_assessment TEXT,
  recommendations_for_coach TEXT,
  model_used TEXT DEFAULT 'gemini-3-flash',
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ai_call_reviews_unique_call ON ai_call_reviews(call_log_id);
CREATE INDEX idx_ai_call_reviews_client ON ai_call_reviews(client_id);
CREATE INDEX idx_ai_call_reviews_coach ON ai_call_reviews(coach_id);

ALTER TABLE ai_call_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view their client reviews"
  ON ai_call_reviews FOR SELECT USING (coach_id = auth.uid());

CREATE POLICY "Clients can view own reviews"
  ON ai_call_reviews FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Service role can insert reviews"
  ON ai_call_reviews FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update reviews"
  ON ai_call_reviews FOR UPDATE USING (true);

-- ========================
-- INDEXES
-- ========================
CREATE INDEX idx_clients_coach ON clients(coach_id);
CREATE INDEX idx_clients_user ON clients(user_id);
CREATE INDEX idx_call_logs_client ON call_logs(client_id);
CREATE INDEX idx_call_logs_coach ON call_logs(coach_id);
CREATE INDEX idx_action_items_client ON action_items(client_id);
CREATE INDEX idx_action_items_call ON action_items(call_log_id);
CREATE INDEX idx_notes_client ON notes(client_id);
CREATE INDEX idx_milestones_client ON milestones(client_id);
CREATE INDEX idx_milestones_template ON milestones(template_id);
CREATE INDEX idx_checkins_client ON confidence_checkins(client_id);
CREATE INDEX idx_ghl_messages_client ON ghl_messages(client_id);

-- ========================
-- UPDATED_AT TRIGGERS
-- ========================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER clients_updated BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER coach_settings_updated BEFORE UPDATE ON coach_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER milestones_updated BEFORE UPDATE ON milestones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER notes_updated BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER intake_responses_updated BEFORE UPDATE ON intake_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ai_call_reviews_updated BEFORE UPDATE ON ai_call_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER blueprint_templates_updated BEFORE UPDATE ON blueprint_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
