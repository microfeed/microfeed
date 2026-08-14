-- Personal-site media library: a global registry of uploaded media so the
-- owner can upload once and reuse the same image across posts. Records are
-- created when a signed upload completes (see src/pages/media-upload/[...key].ts)
-- and are removed when the owner deletes the entry from the Admin library.

CREATE TABLE IF NOT EXISTS media_library (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  format TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS media_library_created_at
ON media_library (created_at);
