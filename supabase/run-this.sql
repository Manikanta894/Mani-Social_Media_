-- Create missing parent tables
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS ai_modules (module_key TEXT PRIMARY KEY, display_name TEXT NOT NULL, provider_id TEXT, model TEXT, enabled BOOLEAN DEFAULT true, settings JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE ai_modules DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS seasonal_events (id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, date DATE NOT NULL, category TEXT DEFAULT 'observance', description TEXT, lead_time_days INTEGER DEFAULT 3, source TEXT DEFAULT 'public', recurs_yearly BOOLEAN DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE seasonal_events DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS comments_queue (id BIGSERIAL PRIMARY KEY, platform TEXT NOT NULL, platform_comment_id TEXT, author TEXT, comment_text TEXT, draft_reply TEXT DEFAULT '', status TEXT DEFAULT 'pending', post_job_id TEXT, type TEXT DEFAULT 'comment', dm_content TEXT, reaction_summary TEXT, auto_sendable BOOLEAN DEFAULT false, auto_sent BOOLEAN DEFAULT false, sentiment TEXT DEFAULT 'neutral', commenter_follower_count INTEGER DEFAULT 0, ai_generated_draft BOOLEAN DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE comments_queue DISABLE ROW LEVEL SECURITY;

DO $sql$
BEGIN
  ALTER TABLE seasonal_events ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 3;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$sql$;

DO $sql$
BEGIN
  ALTER TABLE seasonal_events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'public';
EXCEPTION WHEN OTHERS THEN NULL;
END;
$sql$;

DO $sql$
BEGIN
  ALTER TABLE seasonal_events ADD COLUMN IF NOT EXISTS recurs_yearly BOOLEAN DEFAULT false;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$sql$;

DO $sql$
BEGIN
  ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS notification_level TEXT DEFAULT 'failures_only';
EXCEPTION WHEN OTHERS THEN NULL;
END;
$sql$;

DO $sql$
BEGIN
  ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS tone_adjustment REAL DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$sql$;

DO $sql$
BEGIN
  ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS image_refs JSONB DEFAULT '[]'::jsonb;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$sql$;

DO $sql$
BEGIN
  ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS campaign_id TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$sql$;

DO $sql$
BEGIN
  ALTER TABLE content_jobs ADD COLUMN IF NOT EXISTS auto_sent BOOLEAN DEFAULT false;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$sql$;

CREATE TABLE IF NOT EXISTS compose_templates (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, name TEXT NOT NULL, context TEXT DEFAULT '', style_id TEXT, tone_adjustment REAL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE compose_templates DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS follower_snapshots (id BIGSERIAL PRIMARY KEY, platform TEXT NOT NULL, count INTEGER NOT NULL, captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE follower_snapshots DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS pending_hashtag_suggestions (id BIGSERIAL PRIMARY KEY, tag TEXT NOT NULL, source TEXT DEFAULT 'trending', set_id TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE pending_hashtag_suggestions DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS bio_links (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, title TEXT NOT NULL, url TEXT NOT NULL, icon TEXT DEFAULT 'link', sort_order INTEGER DEFAULT 0, visible BOOLEAN DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE bio_links DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS blog_queue (file_id TEXT PRIMARY KEY, file_name TEXT NOT NULL, mime_type TEXT, upload_date TIMESTAMPTZ, queue_position INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'queued', article_data JSONB, ai_provider_used TEXT, generation_time TIMESTAMPTZ, published_url TEXT, published_date TIMESTAMPTZ, archive_date TIMESTAMPTZ, approved_at TIMESTAMPTZ, error TEXT, retry_count INTEGER DEFAULT 0, max_retries INTEGER DEFAULT 3, discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE blog_queue DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS blog_activity (id BIGSERIAL PRIMARY KEY, action TEXT NOT NULL, file_id TEXT REFERENCES blog_queue(file_id) ON DELETE SET NULL, details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE blog_activity DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS automation_activity (id BIGSERIAL PRIMARY KEY, action TEXT NOT NULL, file_id TEXT REFERENCES drive_queue(file_id) ON DELETE SET NULL, job_id TEXT REFERENCES content_jobs(id) ON DELETE SET NULL, details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE automation_activity DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS automation_settings (id BIGSERIAL PRIMARY KEY, key TEXT UNIQUE NOT NULL, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE automation_settings DISABLE ROW LEVEL SECURITY;
