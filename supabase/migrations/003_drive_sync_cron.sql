-- Migration 003: Schedule the drive-sync edge function to run every hour
-- This uses pg_cron (already enabled in migration 002) + pg_net

-- Remove any existing schedule with the same name
SELECT cron.unschedule('drive-sync-hourly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'drive-sync-hourly'
);

-- Schedule drive-sync to run every hour
-- The edge function URL uses the Supabase project ref from environment
SELECT cron.schedule(
  'drive-sync-hourly',
  '0 * * * *',  -- Every hour on the hour
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/drive-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
