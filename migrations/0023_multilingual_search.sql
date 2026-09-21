-- Character search is derived and is populated by deployment preparation.

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

INSERT OR IGNORE INTO site_search_character_state (content_type, content_id, generation, revision)
SELECT 'item', id, lower(hex(randomblob(16))), 0 FROM items WHERE status != 3;
INSERT OR IGNORE INTO site_search_character_state (content_type, content_id, generation, revision)
SELECT 'page', id, lower(hex(randomblob(16))), 0 FROM pages
WHERE status != 3 AND slug != '404' COLLATE NOCASE;

UPDATE site_search_metadata SET ready = 0, normalized_at = NULL WHERE id = 1;
