-- Personal-site series: a managed list of series assignable to items.
-- Series are typed so posts and podcasts keep separate series. An item can
-- belong to at most one series, with an optional series number.

CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('post', 'podcast')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL COLLATE NOCASE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (kind, slug)
);

CREATE TABLE IF NOT EXISTS item_series (
  item_id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  series_number INTEGER
);

CREATE INDEX IF NOT EXISTS item_series_series_id
ON item_series (series_id);
