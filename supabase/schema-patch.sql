-- Schema patch — safe to re-run (all IF NOT EXISTS)

-- provider_usage table
CREATE TABLE IF NOT EXISTS provider_usage (
  id BIGSERIAL PRIMARY KEY,
  provider_id TEXT REFERENCES ai_providers(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_usage_month ON provider_usage(provider_id, month);
ALTER TABLE provider_usage ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_only" ON provider_usage FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- content_jobs new columns
ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS platform_status JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS pillar TEXT DEFAULT 'general';
ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS cross_link_url TEXT;

-- platform_credentials new columns
ALTER TABLE platform_credentials ADD COLUMN IF NOT EXISTS rate_limit_reset_at TIMESTAMPTZ;
ALTER TABLE platform_credentials ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- mentions table
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
DO $$ BEGIN
  CREATE POLICY "service_role_only" ON mentions FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Blog Automation Engine — independent queue
CREATE TABLE IF NOT EXISTS blog_queue (
  file_id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  upload_date TIMESTAMPTZ,
  queue_position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  article_data JSONB,
  ai_provider_used TEXT,
  generation_time TIMESTAMPTZ,
  published_url TEXT,
  published_date TIMESTAMPTZ,
  archive_date TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blog_queue_status ON blog_queue(status);
ALTER TABLE blog_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_only" ON blog_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Blog activity log
CREATE TABLE IF NOT EXISTS blog_activity (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  file_id TEXT REFERENCES blog_queue(file_id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE blog_activity ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_only" ON blog_activity FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Automation Engine — enhanced drive_queue columns
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS folder_prefix TEXT DEFAULT 'social';
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS ai_analysis JSONB;
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS platform_content JSONB;
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS ai_provider_used TEXT;
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS ai_confidence REAL;
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS generation_time TIMESTAMPTZ;
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS scheduled_slot_index INTEGER;
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS scheduled_time TEXT;
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS published_platforms TEXT[] DEFAULT '{}';
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS failed_platforms TEXT[] DEFAULT '{}';
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT false;
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS tg_message_id BIGINT;
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS tg_chat_id TEXT;
ALTER TABLE drive_queue ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Activity log for automation dashboard
CREATE TABLE IF NOT EXISTS automation_activity (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,          -- ai_generated | approved | published | failed | skipped | archived | edited | regenerated
  file_id TEXT REFERENCES drive_queue(file_id) ON DELETE SET NULL,
  job_id TEXT REFERENCES content_jobs(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE automation_activity ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_only" ON automation_activity FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Automation settings (replaces single app_settings row)
CREATE TABLE IF NOT EXISTS automation_settings (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_only" ON automation_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
