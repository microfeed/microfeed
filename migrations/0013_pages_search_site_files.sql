CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL COLLATE NOCASE,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  content_text TEXT NOT NULL DEFAULT '',
  status INTEGER NOT NULL DEFAULT 2 CHECK (status IN (1, 2, 3, 4)),
  meta_description TEXT,
  show_in_navigation BOOLEAN NOT NULL DEFAULT 1,
  navigation_label TEXT NOT NULL DEFAULT '',
  navigation_order INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS pages_status ON pages (status);
CREATE INDEX IF NOT EXISTS pages_navigation
ON pages (status, show_in_navigation, navigation_order, title, id);
CREATE INDEX IF NOT EXISTS pages_updated_at ON pages (updated_at, id);

CREATE TABLE IF NOT EXISTS page_paths (
  slug TEXT PRIMARY KEY COLLATE NOCASE,
  page_id TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS page_paths_current_page
ON page_paths (page_id) WHERE is_current = 1;
CREATE INDEX IF NOT EXISTS page_paths_page_id ON page_paths (page_id);

CREATE TABLE IF NOT EXISTS site_files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL COLLATE NOCASE UNIQUE,
  generator TEXT CHECK (generator IN ('robots', 'llms', 'sitemap')),
  mode TEXT NOT NULL DEFAULT 'override' CHECK (mode IN ('generated', 'override')),
  draft_content TEXT NOT NULL DEFAULT '',
  published_content TEXT,
  content_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP
);

INSERT OR IGNORE INTO site_files (
  id, filename, generator, mode, content_type, enabled
) VALUES
  ('system-robots', 'robots.txt', 'robots', 'generated', 'text/plain', 1),
  ('system-llms', 'llms.txt', 'llms', 'generated', 'text/plain', 1),
  ('system-sitemap', 'sitemap.xml', 'sitemap', 'generated', 'application/xml', 1);

CREATE TABLE IF NOT EXISTS site_search_metadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ready BOOLEAN NOT NULL DEFAULT 0,
  normalized_at TIMESTAMP
);

-- Historical portable snapshots omit the old derived search tables. Recreate
-- this tiny metadata table when upgrading one of those snapshots so the
-- readiness state can be copied when it exists and safely defaults to false
-- when it does not.
CREATE TABLE IF NOT EXISTS item_search_metadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ready BOOLEAN NOT NULL DEFAULT 0,
  normalized_at TIMESTAMP
);

INSERT OR IGNORE INTO item_search_metadata (id, ready) VALUES (1, 0);

INSERT OR REPLACE INTO site_search_metadata (id, ready, normalized_at)
SELECT
  1,
  COALESCE((SELECT ready FROM item_search_metadata WHERE id = 1), 0),
  (SELECT normalized_at FROM item_search_metadata WHERE id = 1);

CREATE TABLE IF NOT EXISTS site_search_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL CHECK (content_type IN ('item', 'page')),
  content_id TEXT NOT NULL,
  status INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content_text TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL,
  image TEXT,
  UNIQUE(content_type, content_id)
);

CREATE INDEX IF NOT EXISTS site_search_documents_source
ON site_search_documents (content_type, content_id);
CREATE INDEX IF NOT EXISTS site_search_documents_status
ON site_search_documents (content_type, status, published_at, content_id);

CREATE VIRTUAL TABLE IF NOT EXISTS site_search_exact USING fts5(
  content_type UNINDEXED,
  content_id UNINDEXED,
  title,
  content_text,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE IF NOT EXISTS site_search_title_trigram USING fts5(
  content_type UNINDEXED,
  content_id UNINDEXED,
  title,
  tokenize = 'trigram'
);

CREATE TRIGGER IF NOT EXISTS site_search_documents_after_insert
AFTER INSERT ON site_search_documents
BEGIN
  INSERT INTO site_search_exact(
    rowid, content_type, content_id, title, content_text
  ) VALUES (
    NEW.id, NEW.content_type, NEW.content_id, NEW.title, NEW.content_text
  );
  INSERT INTO site_search_title_trigram(
    rowid, content_type, content_id, title
  ) VALUES (
    NEW.id, NEW.content_type, NEW.content_id, NEW.title
  );
END;

CREATE TRIGGER IF NOT EXISTS site_search_documents_after_update
AFTER UPDATE ON site_search_documents
BEGIN
  DELETE FROM site_search_exact WHERE rowid = OLD.id;
  DELETE FROM site_search_title_trigram WHERE rowid = OLD.id;
  INSERT INTO site_search_exact(
    rowid, content_type, content_id, title, content_text
  ) VALUES (
    NEW.id, NEW.content_type, NEW.content_id, NEW.title, NEW.content_text
  );
  INSERT INTO site_search_title_trigram(
    rowid, content_type, content_id, title
  ) VALUES (
    NEW.id, NEW.content_type, NEW.content_id, NEW.title
  );
END;

CREATE TRIGGER IF NOT EXISTS site_search_documents_after_delete
AFTER DELETE ON site_search_documents
BEGIN
  DELETE FROM site_search_exact WHERE rowid = OLD.id;
  DELETE FROM site_search_title_trigram WHERE rowid = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS items_site_search_after_insert
AFTER INSERT ON items
WHEN NEW.status != 3
BEGIN
  INSERT INTO site_search_documents (
    content_type, content_id, status, title, content_text,
    published_at, updated_at, image
  ) VALUES (
    'item', NEW.id, NEW.status,
    COALESCE(json_extract(NEW.data, '$.title'), ''),
    NEW.content_text, NEW.pub_date, NEW.updated_at,
    json_extract(NEW.data, '$.image')
  );
END;

CREATE TRIGGER IF NOT EXISTS items_site_search_after_update
AFTER UPDATE ON items
BEGIN
  DELETE FROM site_search_documents
  WHERE content_type = 'item' AND content_id = OLD.id;
  INSERT INTO site_search_documents (
    content_type, content_id, status, title, content_text,
    published_at, updated_at, image
  )
  SELECT
    'item', NEW.id, NEW.status,
    COALESCE(json_extract(NEW.data, '$.title'), ''),
    NEW.content_text, NEW.pub_date, NEW.updated_at,
    json_extract(NEW.data, '$.image')
  WHERE NEW.status != 3;
END;

CREATE TRIGGER IF NOT EXISTS items_site_search_after_delete
AFTER DELETE ON items
BEGIN
  DELETE FROM site_search_documents
  WHERE content_type = 'item' AND content_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS pages_site_search_after_insert
AFTER INSERT ON pages
WHEN NEW.status != 3
BEGIN
  INSERT INTO site_search_documents (
    content_type, content_id, status, title, content_text,
    published_at, updated_at, image
  ) VALUES (
    'page', NEW.id, NEW.status, NEW.title, NEW.content_text,
    NEW.published_at, NEW.updated_at, NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS pages_site_search_after_update
AFTER UPDATE ON pages
BEGIN
  DELETE FROM site_search_documents
  WHERE content_type = 'page' AND content_id = OLD.id;
  INSERT INTO site_search_documents (
    content_type, content_id, status, title, content_text,
    published_at, updated_at, image
  )
  SELECT
    'page', NEW.id, NEW.status, NEW.title, NEW.content_text,
    NEW.published_at, NEW.updated_at, NULL
  WHERE NEW.status != 3;
END;

CREATE TRIGGER IF NOT EXISTS pages_site_search_after_delete
AFTER DELETE ON pages
BEGIN
  DELETE FROM site_search_documents
  WHERE content_type = 'page' AND content_id = OLD.id;
END;

INSERT OR IGNORE INTO site_search_documents (
  content_type, content_id, status, title, content_text,
  published_at, updated_at, image
)
SELECT
  'item', id, status, COALESCE(json_extract(data, '$.title'), ''),
  content_text, pub_date, updated_at, json_extract(data, '$.image')
FROM items
WHERE status != 3;

DROP TRIGGER IF EXISTS items_search_after_insert;
DROP TRIGGER IF EXISTS items_search_after_update;
DROP TRIGGER IF EXISTS items_search_after_delete;
DROP TABLE IF EXISTS item_search_exact;
DROP TABLE IF EXISTS item_search_title_trigram;
