-- ============================================================
-- SocialForge — Supabase schema (single admin, RLS enforced)
-- Run once in your Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- service_role-only policies defined below each table.
--
-- ⚠️ After running this schema, also run cron.sql to set up the
--    1-minute automation tick via pg_cron + pg_net extensions.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Universal updated_at trigger fn -----------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Prompt styles ----------------------------------------------
CREATE TABLE IF NOT EXISTS prompt_styles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_prompt_styles_updated ON prompt_styles;
CREATE TRIGGER trg_prompt_styles_updated BEFORE UPDATE ON prompt_styles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE prompt_styles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON prompt_styles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- AI providers (user's own keys) -----------------------------
CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  type TEXT NOT NULL,               -- gemini | openai | anthropic | groq | custom
  api_key TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  base_url TEXT,
  active_for_vision BOOLEAN NOT NULL DEFAULT FALSE,
  active_for_text  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_ai_providers_updated ON ai_providers;
CREATE TRIGGER trg_ai_providers_updated BEFORE UPDATE ON ai_providers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON ai_providers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Content jobs (drafts / approvals / scheduled / published) --
CREATE TABLE IF NOT EXISTS content_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source TEXT NOT NULL DEFAULT 'ai_manual',   -- ai_manual | ai_drive | manual
  topic TEXT NOT NULL DEFAULT '',
  research_context TEXT NOT NULL DEFAULT '',
  image_ref TEXT,
  style_id TEXT,
  style_name TEXT,
  platform_posts JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',       -- draft|pending_approval|approved|scheduled|published|rejected|failed
  telegram_chat_id TEXT,
  telegram_message_id BIGINT,
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  published_url TEXT,
  publish_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  drive_file_id TEXT,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_jobs_status ON content_jobs(status);
CREATE INDEX IF NOT EXISTS idx_content_jobs_scheduled
  ON content_jobs(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_content_jobs_created ON content_jobs(created_at DESC);
DROP TRIGGER IF EXISTS trg_content_jobs_updated ON content_jobs;
CREATE TRIGGER trg_content_jobs_updated BEFORE UPDATE ON content_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE content_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON content_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- App settings (single row keyed on 'main') ------------------
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_app_settings_updated ON app_settings;
CREATE TRIGGER trg_app_settings_updated BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON app_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Platform credentials (LinkedIn / Meta / Threads tokens) ----
CREATE TABLE IF NOT EXISTS platform_credentials (
  platform TEXT PRIMARY KEY,        -- linkedin | facebook | instagram | threads
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_platform_credentials_updated ON platform_credentials;
CREATE TRIGGER trg_platform_credentials_updated BEFORE UPDATE ON platform_credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE platform_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON platform_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Media queue (intake from Supabase Storage) ------------------
-- Managed by lib/intake.js — syncs files from the 'intake' bucket.

CREATE TABLE IF NOT EXISTS drive_queue (
  file_id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  drive_folder TEXT,
  mime_type TEXT,
  file_type TEXT DEFAULT 'image',
  upload_date TIMESTAMPTZ,
  queue_position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',  -- new|queued|processing|pending_approval|approved|scheduled|published|failed|archived|skipped
  content_job_id TEXT REFERENCES content_jobs(id) ON DELETE SET NULL,
  scheduled_date TIMESTAMPTZ,
  published_date TIMESTAMPTZ,
  archive_date TIMESTAMPTZ,
  error TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drive_queue_status ON drive_queue(status);
CREATE INDEX IF NOT EXISTS idx_drive_queue_position
  ON drive_queue(queue_position) WHERE status = 'queued';
DROP TRIGGER IF EXISTS trg_drive_queue_updated ON drive_queue;
CREATE TRIGGER trg_drive_queue_updated BEFORE UPDATE ON drive_queue
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE drive_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON drive_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- AI Automation Center (slice 6) -----------------------------
CREATE TABLE IF NOT EXISTS ai_modules (
  module_key TEXT PRIMARY KEY,      -- caption | hashtag | image_analyzer | ocr | image_gen | ...
  display_name TEXT NOT NULL,
  provider_id TEXT REFERENCES ai_providers(id) ON DELETE SET NULL,
  model TEXT,
  prompt_template TEXT NOT NULL DEFAULT '',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_ai_modules_updated ON ai_modules;
CREATE TRIGGER trg_ai_modules_updated BEFORE UPDATE ON ai_modules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE ai_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON ai_modules FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS platform_prompts (
  platform TEXT PRIMARY KEY,        -- linkedin | instagram | facebook | threads | pinterest | tiktok | youtube
  prompt_template TEXT NOT NULL DEFAULT '',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_platform_prompts_updated ON platform_prompts;
CREATE TRIGGER trg_platform_prompts_updated BEFORE UPDATE ON platform_prompts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE platform_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON platform_prompts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Telegram ---------------------------------------------------
CREATE TABLE IF NOT EXISTS telegram_accounts (
  telegram_user_id BIGINT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language TEXT,
  timezone TEXT,
  connection_status TEXT NOT NULL DEFAULT 'connected',  -- connected|disconnected|pending
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE telegram_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON telegram_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS telegram_activity (
  id BIGSERIAL PRIMARY KEY,
  chat_id BIGINT,
  event_type TEXT NOT NULL,         -- command | callback | notification_sent | error
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_telegram_activity_created ON telegram_activity(created_at DESC);
ALTER TABLE telegram_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON telegram_activity FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Analytics --------------------------------------------------
CREATE TABLE IF NOT EXISTS post_stats (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT REFERENCES content_jobs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_post_stats_job ON post_stats(job_id);
ALTER TABLE post_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON post_stats FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Hashtag stats (aggregated per tag) -------------------------
CREATE TABLE IF NOT EXISTS hashtag_stats (
  id BIGSERIAL PRIMARY KEY,
  tag TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  platforms TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hashtag_stats_tag ON hashtag_stats(tag);
ALTER TABLE hashtag_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON hashtag_stats FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Post details (per-post analytics) --------------------------
CREATE TABLE IF NOT EXISTS post_details (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT REFERENCES content_jobs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  profile_visits INTEGER DEFAULT 0,
  caption TEXT DEFAULT '',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_post_details_job ON post_details(job_id);
ALTER TABLE post_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON post_details FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Comments queue ---------------------------------------------
CREATE TABLE IF NOT EXISTS comments_queue (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  platform TEXT NOT NULL,
  platform_comment_id TEXT,
  author TEXT,
  comment_text TEXT,
  draft_reply TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | replied | ignored
  post_job_id TEXT REFERENCES content_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE comments_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON comments_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Dedup log --------------------------------------------------
CREATE TABLE IF NOT EXISTS dedup_log (
  content_hash TEXT PRIMARY KEY,
  topic TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE dedup_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON dedup_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Content versions (AI generation history) -------------------
CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id TEXT REFERENCES content_jobs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  platform TEXT NOT NULL,
  caption TEXT,
  description TEXT,
  hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
  alt_text TEXT,
  seo_keywords TEXT,
  cta TEXT,
  ai_confidence REAL,
  providers_used JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_versions_job ON content_versions(job_id);
ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON content_versions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Audit log ---------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,                -- generate | edit | regenerate | approve | publish | reject | skip | schedule
  entity_type TEXT NOT NULL,           -- content_job | drive_queue | comment
  entity_id TEXT,
  previous_status TEXT,
  new_status TEXT,
  metadata JSONB,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- News sources (RSS/Atom feeds to monitor) --------------------
CREATE TABLE IF NOT EXISTS news_sources (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'rss',        -- rss | atom | custom
  category TEXT NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  check_interval INTEGER NOT NULL DEFAULT 15,  -- minutes
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_news_sources_updated ON news_sources;
CREATE TRIGGER trg_news_sources_updated BEFORE UPDATE ON news_sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE news_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON news_sources FOR ALL TO service_role USING (true) WITH CHECK (true);

-- News posts (breaking news items, independent queue) -----------
CREATE TABLE IF NOT EXISTS news_posts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_id TEXT REFERENCES news_sources(id) ON DELETE SET NULL,
  source_name TEXT,
  title TEXT NOT NULL,
  url TEXT,
  summary TEXT,
  content TEXT,
  image_url TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  topic TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  is_trending BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'new',       -- new|ai_generated|pending_approval|approved|scheduled|published|rejected|archived
  generated_posts JSONB,                   -- per-platform AI captions
  scheduled_for TIMESTAMPTZ,
  published_at_actual TIMESTAMPTZ,
  publish_results JSONB,
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  conflict_warning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_news_posts_status ON news_posts(status);
CREATE INDEX IF NOT EXISTS idx_news_posts_source ON news_posts(source_id);
CREATE INDEX IF NOT EXISTS idx_news_posts_created ON news_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_posts_topic ON news_posts(topic);
DROP TRIGGER IF EXISTS trg_news_posts_updated ON news_posts;
CREATE TRIGGER trg_news_posts_updated BEFORE UPDATE ON news_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE news_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON news_posts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Campaigns (bulk post grouping) ------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  platforms TEXT[] DEFAULT '{}',
  schedule_settings JSONB DEFAULT '{}'::jsonb,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_campaigns_updated ON campaigns;
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Blog posts (long-form articles for Hashnode) ----------------
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id TEXT REFERENCES content_jobs(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  slug TEXT,
  body_markdown TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  seo_description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',  -- draft|pending_approval|approved|published|failed
  target TEXT NOT NULL DEFAULT 'hashnode',
  published_url TEXT,
  published_at TIMESTAMPTZ,
  publish_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created ON blog_posts(created_at DESC);
DROP TRIGGER IF EXISTS trg_blog_posts_updated ON blog_posts;
CREATE TRIGGER trg_blog_posts_updated BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON blog_posts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Rate-limit tracking (per platform) -------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  platform TEXT PRIMARY KEY,
  last_429_at TIMESTAMPTZ,
  retry_after_seconds INTEGER DEFAULT 0,
  cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_rate_limits_updated ON rate_limits;
CREATE TRIGGER trg_rate_limits_updated BEFORE UPDATE ON rate_limits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Hashtag sets (saved reusable groups) -----------------------
CREATE TABLE IF NOT EXISTS hashtag_sets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_hashtag_sets_updated ON hashtag_sets;
CREATE TRIGGER trg_hashtag_sets_updated BEFORE UPDATE ON hashtag_sets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE hashtag_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON hashtag_sets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Channel groups (multi-account publish sets) -----------------
CREATE TABLE IF NOT EXISTS channel_groups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  platform_credential_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE channel_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON channel_groups FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Engagement inbox (unified comments + DMs + reaction summary) -
ALTER TABLE comments_queue ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'comment';
ALTER TABLE comments_queue ADD COLUMN IF NOT EXISTS dm_content TEXT;
ALTER TABLE comments_queue ADD COLUMN IF NOT EXISTS reaction_summary JSONB DEFAULT '{}'::jsonb;

-- First-comment on content_jobs
ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS first_comment JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Best-time-to-post cache ------------------------------------
CREATE TABLE IF NOT EXISTS best_time_cache (
  id BIGSERIAL PRIMARY KEY,
  platform TEXT NOT NULL,
  hour_of_day INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  avg_engagement REAL DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_best_time_bucket ON best_time_cache(platform, day_of_week, hour_of_day);
ALTER TABLE best_time_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON best_time_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seasonal Intelligence Queue (isolated from content_jobs) ------
CREATE TABLE IF NOT EXISTS seasonal_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_month INT NOT NULL,
  event_day INT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'observance',
  event_country TEXT,
  event_industry TEXT DEFAULT 'general',
  emoji TEXT DEFAULT '📅',
  platform_posts JSONB NOT NULL DEFAULT '{}',
  analysis JSONB,
  scheduled_for TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  source TEXT NOT NULL DEFAULT 'auto',
  versions JSONB[] DEFAULT ARRAY[]::JSONB[],
  ai_confidence REAL,
  draft_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_seasonal_queue_updated ON seasonal_queue;
CREATE TRIGGER trg_seasonal_queue_updated BEFORE UPDATE ON seasonal_queue
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE seasonal_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON seasonal_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Per-platform publish status ---------------------------------
ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS platform_status JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Content pillars --------------------------------------------
ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS pillar TEXT DEFAULT 'general';

-- Cross-link URL (auto cross-linking) -------------------------
ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS cross_link_url TEXT;

-- Provider usage tracking ------------------------------------
CREATE TABLE IF NOT EXISTS provider_usage (
  id BIGSERIAL PRIMARY KEY,
  provider_id TEXT REFERENCES ai_providers(id) ON DELETE CASCADE,
  month TEXT NOT NULL,   -- YYYY-MM format
  call_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_usage_month ON provider_usage(provider_id, month);
ALTER TABLE provider_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON provider_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Rate-limit reset tracking on platform_credentials -----------
ALTER TABLE platform_credentials ADD COLUMN IF NOT EXISTS rate_limit_reset_at TIMESTAMPTZ;

-- Token expiry tracking on platform_credentials ---------------
ALTER TABLE platform_credentials ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Social listening (brand mentions) ---------------------------
CREATE TABLE IF NOT EXISTS mentions (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  url TEXT,
  title TEXT,
  snippet TEXT,
  matched_keyword TEXT,
  sentiment TEXT DEFAULT 'neutral',
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON mentions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- End ---------------------------------------------------------
