-- Migration 002: Google Drive Integration
-- Adds Drive folder tracking to clients and a table to prevent reprocessing files

-- 1. Add Google Drive folder ID to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_last_synced_at TIMESTAMPTZ;

-- 2. Table to track which Drive files have already been processed
CREATE TABLE IF NOT EXISTS processed_drive_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  drive_file_id TEXT NOT NULL,           -- Google Drive file ID
  drive_file_name TEXT,                  -- Original filename (e.g., "2024-01-15 - Call Notes")
  call_log_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'success',         -- 'success' | 'error' | 'skipped'
  error_message TEXT,
  UNIQUE(drive_file_id)                  -- Never process the same file twice
);

-- Index for lookups by client
CREATE INDEX IF NOT EXISTS processed_drive_files_client_id_idx
  ON processed_drive_files(client_id);

-- 3. RLS policies for processed_drive_files (coach-only access)
ALTER TABLE processed_drive_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view drive sync logs for their clients"
  ON processed_drive_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = processed_drive_files.client_id
        AND clients.coach_id = auth.uid()
    )
  );

-- 3b. Add source tracking + priority to call_logs and action_items
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'; -- 'manual' | 'google_drive'

ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'; -- 'manual' | 'ai_extracted'

-- 4. Enable pg_cron extension if not already enabled (for scheduled syncing)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 5. Enable net extension for HTTP calls from pg_cron
CREATE EXTENSION IF NOT EXISTS "pg_net";
