-- ============================================================
-- Content Library (unified historical post archive) + dedupe
-- Run in Supabase SQL Editor once.
-- ============================================================

CREATE TABLE IF NOT EXISTS content_library (
  id BIGSERIAL PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_post_id TEXT NOT NULL,
  url TEXT,
  caption TEXT DEFAULT '',
  thumbnail_url TEXT,
  media_type TEXT DEFAULT 'text',
  source TEXT NOT NULL DEFAULT 'import',
  job_id TEXT,
  published_at TIMESTAMPTZ,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  profile_visits INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform, platform_post_id)
);
CREATE INDEX IF NOT EXISTS idx_content_library_published ON content_library (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_library_platform ON content_library (platform);
CREATE INDEX IF NOT EXISTS idx_content_library_job ON content_library (job_id);

-- Dedupe existing post_details (keep newest row per job_id+platform)
DO $$
BEGIN
  DELETE FROM post_details a
  USING post_details b
  WHERE a.job_id = b.job_id
    AND a.platform = b.platform
    AND a.checked_at < b.checked_at;
END $$;

-- Make post_details upsertable on (job_id, platform)
DROP INDEX IF EXISTS idx_post_details_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_details_unique ON post_details (job_id, platform);
