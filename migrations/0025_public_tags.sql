-- Tags are always public. Deletion retains a tombstone and reserved aliases.
-- Fail safely even for migrations applied without the management preflight.
CREATE TABLE public_tags_route_guard (conflicts INTEGER CHECK(conflicts = 0));
INSERT INTO public_tags_route_guard SELECT count(*) FROM page_paths WHERE slug = 'tags' COLLATE NOCASE;
INSERT INTO public_tags_route_guard SELECT count(*) FROM pages WHERE slug = 'tags' COLLATE NOCASE;
DROP TABLE public_tags_route_guard;
CREATE TABLE tags (
  id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 50),
  name_key TEXT NOT NULL, slug TEXT NOT NULL CHECK(length(slug) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE UNIQUE INDEX tags_active_name ON tags(name_key) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX tags_active_slug ON tags(slug) WHERE deleted_at IS NULL;
CREATE TABLE tag_paths (slug TEXT PRIMARY KEY, tag_id TEXT NOT NULL REFERENCES tags(id));
CREATE INDEX tag_paths_owner ON tag_paths(tag_id);
CREATE TABLE item_tags (
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id),
  PRIMARY KEY(item_id, tag_id)
);
CREATE INDEX item_tags_tag ON item_tags(tag_id, item_id);
CREATE TRIGGER item_tags_active BEFORE INSERT ON item_tags BEGIN
  SELECT RAISE(ABORT, 'tag_reference_conflict') WHERE NOT EXISTS
    (SELECT 1 FROM tags WHERE id = NEW.tag_id AND deleted_at IS NULL);
END;
CREATE TRIGGER tags_reserved_insert BEFORE INSERT ON tags BEGIN
  SELECT RAISE(ABORT, 'tag_slug_conflict') WHERE EXISTS
    (SELECT 1 FROM tag_paths WHERE slug = NEW.slug AND tag_id != NEW.id);
END;
CREATE TRIGGER tags_reserved_update BEFORE UPDATE OF slug ON tags BEGIN
  SELECT RAISE(ABORT, 'tag_slug_conflict') WHERE EXISTS
    (SELECT 1 FROM tag_paths WHERE slug = NEW.slug AND tag_id != NEW.id);
END;

UPDATE site_search_metadata
SET ready = 0, normalized_at = NULL
WHERE id = 1;

DROP TRIGGER IF EXISTS tags_character_search_insert;
DROP TRIGGER IF EXISTS tags_character_search_update;
DROP TRIGGER IF EXISTS tags_character_search_delete;
DROP TRIGGER IF EXISTS items_character_search_insert;
DROP TRIGGER IF EXISTS items_character_search_update;
DROP TRIGGER IF EXISTS items_character_search_delete;
DROP TRIGGER IF EXISTS pages_character_search_insert;
DROP TRIGGER IF EXISTS pages_character_search_update;
DROP TRIGGER IF EXISTS pages_character_search_delete;
DROP TRIGGER IF EXISTS character_chunks_insert;
DROP TRIGGER IF EXISTS character_chunks_delete;
DROP TABLE IF EXISTS site_search_bigram;
DELETE FROM site_search_character_chunks;
DELETE FROM site_search_character_state;

DROP TRIGGER IF EXISTS tags_site_search_after_insert;
DROP TRIGGER IF EXISTS tags_site_search_after_update;
DROP TRIGGER IF EXISTS tags_site_search_after_delete;
DROP TRIGGER IF EXISTS items_site_search_after_insert;
DROP TRIGGER IF EXISTS items_site_search_after_update;
DROP TRIGGER IF EXISTS items_site_search_after_delete;
DROP TRIGGER IF EXISTS pages_site_search_after_insert;
DROP TRIGGER IF EXISTS pages_site_search_after_update;
DROP TRIGGER IF EXISTS pages_site_search_after_delete;
DROP TRIGGER IF EXISTS site_search_documents_after_insert;
DROP TRIGGER IF EXISTS site_search_documents_after_update;
DROP TRIGGER IF EXISTS site_search_documents_after_delete;
DROP TABLE IF EXISTS site_search_exact;
DROP TABLE IF EXISTS site_search_title_trigram;
DELETE FROM site_search_documents;
DROP TABLE site_search_documents;
CREATE TABLE site_search_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL CHECK(content_type IN ('item','page','tag')),
  content_id TEXT NOT NULL, status INTEGER NOT NULL, title TEXT NOT NULL DEFAULT '',
  content_text TEXT NOT NULL DEFAULT '', published_at TIMESTAMP, updated_at TIMESTAMP NOT NULL,
  image TEXT, slug TEXT, UNIQUE(content_type,content_id)
);
CREATE INDEX site_search_documents_source ON site_search_documents(content_type,content_id);
CREATE INDEX site_search_documents_status ON site_search_documents(content_type,status,published_at,content_id);


CREATE TABLE IF NOT EXISTS site_search_character_state (
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  generation TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  normalized_content_text TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (content_type, content_id)
);
CREATE INDEX IF NOT EXISTS site_search_character_revision
ON site_search_character_state (revision);
CREATE TABLE IF NOT EXISTS site_search_character_chunks (
  id INTEGER PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS site_search_character_source
ON site_search_character_chunks (content_type, content_id);
CREATE VIRTUAL TABLE IF NOT EXISTS site_search_bigram USING fts5(
  title, content_text, content = 'site_search_character_chunks',
  content_rowid = 'id', tokenize = 'ascii'
);
CREATE TRIGGER IF NOT EXISTS character_chunks_insert
AFTER INSERT ON site_search_character_chunks BEGIN
  INSERT INTO site_search_bigram(rowid, title, content_text)
  VALUES (NEW.id, NEW.title, NEW.content_text);
END;
CREATE TRIGGER IF NOT EXISTS character_chunks_delete
AFTER DELETE ON site_search_character_chunks BEGIN
  INSERT INTO site_search_bigram(site_search_bigram, rowid, title, content_text)
  VALUES ('delete', OLD.id, OLD.title, OLD.content_text);
END;

CREATE TRIGGER IF NOT EXISTS items_character_search_insert AFTER INSERT ON items
WHEN NEW.status != 3
BEGIN
    INSERT INTO site_search_character_state (content_type, content_id, generation, revision)
    SELECT 'item', NEW.id, lower(hex(randomblob(16))), 0 WHERE NEW.status != 3; END;
CREATE TRIGGER IF NOT EXISTS items_character_search_update AFTER UPDATE ON items
WHEN OLD.id IS NOT NEW.id OR OLD.status = 3 OR NEW.status = 3
  OR OLD.content_text IS NOT NEW.content_text OR json_extract(OLD.data, '$.title') IS NOT json_extract(NEW.data, '$.title') OR json_extract(OLD.data, '$.description') IS NOT json_extract(NEW.data, '$.description')
BEGIN
    DELETE FROM site_search_character_chunks
    WHERE content_type = 'item' AND content_id = OLD.id;
    DELETE FROM site_search_character_state
    WHERE content_type = 'item' AND content_id = OLD.id;
    INSERT INTO site_search_character_state (content_type, content_id, generation, revision)
    SELECT 'item', NEW.id, lower(hex(randomblob(16))), 0 WHERE NEW.status != 3; END;
CREATE TRIGGER IF NOT EXISTS items_character_search_delete AFTER DELETE ON items
BEGIN
    DELETE FROM site_search_character_chunks
    WHERE content_type = 'item' AND content_id = OLD.id;
    DELETE FROM site_search_character_state
    WHERE content_type = 'item' AND content_id = OLD.id; END;


CREATE TRIGGER IF NOT EXISTS pages_character_search_insert AFTER INSERT ON pages
WHEN NEW.status != 3 AND NEW.slug != '404' COLLATE NOCASE
BEGIN
    INSERT INTO site_search_character_state (content_type, content_id, generation, revision)
    SELECT 'page', NEW.id, lower(hex(randomblob(16))), 0 WHERE NEW.status != 3 AND NEW.slug != '404' COLLATE NOCASE; END;
CREATE TRIGGER IF NOT EXISTS pages_character_search_update AFTER UPDATE ON pages
WHEN OLD.id IS NOT NEW.id OR OLD.status = 3 OR NEW.status = 3
  OR OLD.content_text IS NOT NEW.content_text OR OLD.title IS NOT NEW.title OR OLD.slug IS NOT NEW.slug
BEGIN
    DELETE FROM site_search_character_chunks
    WHERE content_type = 'page' AND content_id = OLD.id;
    DELETE FROM site_search_character_state
    WHERE content_type = 'page' AND content_id = OLD.id;
    INSERT INTO site_search_character_state (content_type, content_id, generation, revision)
    SELECT 'page', NEW.id, lower(hex(randomblob(16))), 0 WHERE NEW.status != 3 AND NEW.slug != '404' COLLATE NOCASE; END;
CREATE TRIGGER IF NOT EXISTS pages_character_search_delete AFTER DELETE ON pages
BEGIN
    DELETE FROM site_search_character_chunks
    WHERE content_type = 'page' AND content_id = OLD.id;
    DELETE FROM site_search_character_state
    WHERE content_type = 'page' AND content_id = OLD.id; END;

CREATE TRIGGER IF NOT EXISTS tags_character_search_insert AFTER INSERT ON tags
WHEN NEW.deleted_at IS NULL BEGIN
  INSERT INTO site_search_character_state (content_type, content_id, generation, revision)
  VALUES ('tag', NEW.id, lower(hex(randomblob(16))), 0);
END;
CREATE TRIGGER IF NOT EXISTS tags_character_search_update AFTER UPDATE ON tags BEGIN
  DELETE FROM site_search_character_chunks WHERE content_type = 'tag' AND content_id = OLD.id;
  DELETE FROM site_search_character_state WHERE content_type = 'tag' AND content_id = OLD.id;
  INSERT INTO site_search_character_state (content_type, content_id, generation, revision)
  SELECT 'tag', NEW.id, lower(hex(randomblob(16))), 0 WHERE NEW.deleted_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS tags_character_search_delete AFTER DELETE ON tags BEGIN
  DELETE FROM site_search_character_chunks WHERE content_type = 'tag' AND content_id = OLD.id;
  DELETE FROM site_search_character_state WHERE content_type = 'tag' AND content_id = OLD.id;
END;
INSERT OR IGNORE INTO site_search_character_state (content_type, content_id, generation, revision)
SELECT 'item', id, lower(hex(randomblob(16))), 0 FROM items WHERE status != 3;
INSERT OR IGNORE INTO site_search_character_state (content_type, content_id, generation, revision)
SELECT 'page', id, lower(hex(randomblob(16))), 0 FROM pages
WHERE status != 3 AND slug != '404' COLLATE NOCASE;
INSERT OR IGNORE INTO site_search_character_state (content_type, content_id, generation, revision)
SELECT 'tag', id, lower(hex(randomblob(16))), 0 FROM tags WHERE deleted_at IS NULL;

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
WHEN NEW.status != 3 AND NEW.slug != '404' COLLATE NOCASE
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
  WHERE NEW.status != 3 AND NEW.slug != '404' COLLATE NOCASE;
END;
CREATE TRIGGER IF NOT EXISTS pages_site_search_after_delete
AFTER DELETE ON pages
BEGIN
  DELETE FROM site_search_documents
  WHERE content_type = 'page' AND content_id = OLD.id;
END;
DELETE FROM site_search_documents;
INSERT INTO site_search_documents (
  content_type, content_id, status, title, content_text,
  published_at, updated_at, image
)
SELECT
  'item', id, status, COALESCE(json_extract(data, '$.title'), ''),
  content_text, pub_date, updated_at, json_extract(data, '$.image')
FROM items
WHERE status != 3;
CREATE TRIGGER IF NOT EXISTS tags_site_search_after_insert AFTER INSERT ON tags
WHEN NEW.deleted_at IS NULL BEGIN
  INSERT INTO site_search_documents (content_type, content_id, status, title, content_text, published_at, updated_at, slug)
  VALUES ('tag', NEW.id, 1, NEW.name, NEW.description, NEW.created_at, NEW.updated_at, NEW.slug);
END;
CREATE TRIGGER IF NOT EXISTS tags_site_search_after_update AFTER UPDATE ON tags BEGIN
  DELETE FROM site_search_documents WHERE content_type = 'tag' AND content_id = OLD.id;
  INSERT INTO site_search_documents (content_type, content_id, status, title, content_text, published_at, updated_at, slug)
  SELECT 'tag', NEW.id, 1, NEW.name, NEW.description, NEW.created_at, NEW.updated_at, NEW.slug WHERE NEW.deleted_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS tags_site_search_after_delete AFTER DELETE ON tags BEGIN
  DELETE FROM site_search_documents WHERE content_type = 'tag' AND content_id = OLD.id;
END;
INSERT INTO site_search_documents (content_type, content_id, status, title, content_text, published_at, updated_at, slug)
SELECT 'tag', id, 1, name, description, created_at, updated_at, slug FROM tags WHERE deleted_at IS NULL;
INSERT INTO site_search_documents (
  content_type, content_id, status, title, content_text,
  published_at, updated_at, image
)
SELECT
  'page', id, status, title, content_text,
  published_at, updated_at, NULL
FROM pages
WHERE status != 3 AND slug != '404' COLLATE NOCASE;
