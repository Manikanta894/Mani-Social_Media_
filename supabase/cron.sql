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

-- ⚠️ MANUAL STEP REQUIRED (not a code task):
-- 1. Open Settings → Automation in the app (or GET /api/automation/settings) to read your tick_secret.
-- 2. Replace TICK_SECRET_HERE with that real value.
-- 3. Replace BASE_URL_HERE with https://social.manikantar.in
-- 4. Paste this whole file into the Supabase SQL Editor and run once.
-- The Automation Settings page in the app also generates this exact SQL with
-- the real secret inlined — copy from there to avoid manual substitution errors.

-- Fire /api/automation/tick every minute.
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
