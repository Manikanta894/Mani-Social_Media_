-- ============================================================
-- SocialForge — 24/7 automation cron via Supabase pg_cron.
-- Run this once in your Supabase SQL Editor.
-- Requires pg_cron + pg_net extensions (Supabase auto-enables them).
-- ============================================================

-- Enable the extensions (Supabase already grants access on Postgres 14+)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Un-schedule any prior job of the same name (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'socialforge-tick') THEN
    PERFORM cron.unschedule('socialforge-tick');
  END IF;
END $$;

-- Fire /api/automation/tick every minute.
-- Replace TICK_SECRET_HERE with the value shown in Settings → Automation → Tick secret
-- Replace BASE_URL_HERE with your NEXT_PUBLIC_BASE_URL
SELECT cron.schedule(
  'socialforge-tick',
  '* * * * *',   -- every minute
  $$
  SELECT net.http_post(
    url := 'BASE_URL_HERE/api/automation/tick',
    headers := '{"X-Automation-Secret": "TICK_SECRET_HERE", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Verify it's scheduled:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'socialforge-tick';

-- To pause automation:
-- UPDATE cron.job SET active = false WHERE jobname = 'socialforge-tick';

-- To remove it:
-- SELECT cron.unschedule('socialforge-tick');
