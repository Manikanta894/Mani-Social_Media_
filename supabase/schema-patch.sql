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
