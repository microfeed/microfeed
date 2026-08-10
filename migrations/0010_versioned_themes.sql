CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  bundle_json TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_url TEXT,
  source_ref TEXT,
  source_path TEXT,
  source_commit TEXT,
  checksum_sha256 TEXT NOT NULL,
  origin_theme_id TEXT,
  asset_owner_theme_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  assets_deleted_at TIMESTAMP,
  asset_cleanup_error TEXT,
  UNIQUE(package_id, version)
);

CREATE INDEX IF NOT EXISTS themes_package_id ON themes (package_id);
CREATE INDEX IF NOT EXISTS themes_created_at ON themes (created_at);
CREATE INDEX IF NOT EXISTS themes_deleted_at ON themes (deleted_at);
CREATE INDEX IF NOT EXISTS themes_asset_owner ON themes (asset_owner_theme_id);

CREATE TABLE IF NOT EXISTS theme_drafts (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  bundle_json TEXT NOT NULL,
  origin_kind TEXT NOT NULL,
  origin_theme_id TEXT,
  asset_owner_theme_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS theme_drafts_updated_at ON theme_drafts (updated_at);
CREATE INDEX IF NOT EXISTS theme_drafts_asset_owner ON theme_drafts (asset_owner_theme_id);

CREATE TABLE IF NOT EXISTS theme_state (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  active_theme_id TEXT,
  previous_theme_id TEXT,
  legacy_theme_id TEXT,
  legacy_migrated_at TIMESTAMP,
  legacy_migration_error TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO theme_state (id, active_theme_id, previous_theme_id)
VALUES ('current', NULL, NULL);

CREATE TABLE IF NOT EXISTS theme_management_tokens (
  token_hash TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  theme_id TEXT,
  expires_at_ms INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS theme_management_tokens_expires
ON theme_management_tokens (expires_at_ms);
