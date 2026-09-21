function sourceTriggers(type: "item" | "page"): string {
  const table = type === "item" ? "items" : "pages";
  const eligible = `NEW.status != 3${type === "page" ? " AND NEW.slug != '404' COLLATE NOCASE" : ""}`;
  const changed = type === "item"
    ? "json_extract(OLD.data, '$.title') IS NOT json_extract(NEW.data, '$.title') OR " +
      "json_extract(OLD.data, '$.description') IS NOT json_extract(NEW.data, '$.description')"
    : "OLD.title IS NOT NEW.title OR OLD.slug IS NOT NEW.slug";
  const remove = `
    DELETE FROM site_search_character_chunks
    WHERE content_type = '${type}' AND content_id = OLD.id;
    DELETE FROM site_search_character_state
    WHERE content_type = '${type}' AND content_id = OLD.id;`;
  const insert = `
    INSERT INTO site_search_character_state (content_type, content_id, generation, revision)
    SELECT '${type}', NEW.id, lower(hex(randomblob(16))), 0 WHERE ${eligible};`;
  return `
CREATE TRIGGER IF NOT EXISTS ${table}_character_search_insert AFTER INSERT ON ${table}
WHEN ${eligible}
BEGIN ${insert} END;
CREATE TRIGGER IF NOT EXISTS ${table}_character_search_update AFTER UPDATE ON ${table}
WHEN OLD.id IS NOT NEW.id OR OLD.status = 3 OR NEW.status = 3
  OR OLD.content_text IS NOT NEW.content_text OR ${changed}
BEGIN ${remove} ${insert} END;
CREATE TRIGGER IF NOT EXISTS ${table}_character_search_delete AFTER DELETE ON ${table}
BEGIN ${remove} END;
`;
}

export const CREATE_CHARACTER_SEARCH_SQL = `
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
${sourceTriggers("item")}
${sourceTriggers("page")}
INSERT OR IGNORE INTO site_search_character_state (content_type, content_id, generation, revision)
SELECT 'item', id, lower(hex(randomblob(16))), 0 FROM items WHERE status != 3;
INSERT OR IGNORE INTO site_search_character_state (content_type, content_id, generation, revision)
SELECT 'page', id, lower(hex(randomblob(16))), 0 FROM pages
WHERE status != 3 AND slug != '404' COLLATE NOCASE;
`;

export const DROP_CHARACTER_SEARCH_SQL = `
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
`;
