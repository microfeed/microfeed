ALTER TABLE items ADD COLUMN content_text TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN content_text_updated_at TIMESTAMP NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN content_text_revision INTEGER NOT NULL DEFAULT 0;

UPDATE items
SET pub_date = COALESCE(
  strftime('%Y-%m-%dT%H:%M:%fZ', pub_date),
  pub_date
)
WHERE instr(pub_date, 'T') = 0;

CREATE TABLE IF NOT EXISTS item_search_metadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ready BOOLEAN NOT NULL DEFAULT 0,
  normalized_at TIMESTAMP
);

INSERT OR IGNORE INTO item_search_metadata (id, ready)
VALUES (
  1,
  CASE WHEN EXISTS (SELECT 1 FROM items WHERE status != 3 LIMIT 1)
    THEN 0 ELSE 1 END
);

CREATE VIRTUAL TABLE IF NOT EXISTS item_search_exact USING fts5(
  item_id UNINDEXED,
  title,
  content_text,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE IF NOT EXISTS item_search_title_trigram USING fts5(
  item_id UNINDEXED,
  title,
  tokenize = 'trigram'
);

CREATE TRIGGER IF NOT EXISTS items_search_after_insert
AFTER INSERT ON items
WHEN NEW.status != 3
BEGIN
  INSERT INTO item_search_exact(rowid, item_id, title, content_text)
  VALUES (
    NEW.rowid,
    NEW.id,
    COALESCE(json_extract(NEW.data, '$.title'), ''),
    NEW.content_text
  );
  INSERT INTO item_search_title_trigram(rowid, item_id, title)
  VALUES (
    NEW.rowid,
    NEW.id,
    COALESCE(json_extract(NEW.data, '$.title'), '')
  );
END;

CREATE TRIGGER IF NOT EXISTS items_search_after_update
AFTER UPDATE ON items
BEGIN
  DELETE FROM item_search_exact WHERE rowid = OLD.rowid;
  DELETE FROM item_search_title_trigram WHERE rowid = OLD.rowid;
  INSERT INTO item_search_exact(rowid, item_id, title, content_text)
  SELECT
    NEW.rowid,
    NEW.id,
    COALESCE(json_extract(NEW.data, '$.title'), ''),
    NEW.content_text
  WHERE NEW.status != 3;
  INSERT INTO item_search_title_trigram(rowid, item_id, title)
  SELECT
    NEW.rowid,
    NEW.id,
    COALESCE(json_extract(NEW.data, '$.title'), '')
  WHERE NEW.status != 3;
END;

CREATE TRIGGER IF NOT EXISTS items_search_after_delete
AFTER DELETE ON items
BEGIN
  DELETE FROM item_search_exact WHERE rowid = OLD.rowid;
  DELETE FROM item_search_title_trigram WHERE rowid = OLD.rowid;
END;
