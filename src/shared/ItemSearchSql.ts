export const ITEM_SEARCH_VIRTUAL_TABLE_PREFIXES = [
  "item_search_exact",
  "item_search_title_trigram",
] as const;

export const DROP_ITEM_SEARCH_INDEX_SQL = `
UPDATE item_search_metadata
SET ready = 0, normalized_at = NULL
WHERE id = 1;
DROP TRIGGER IF EXISTS items_search_after_insert;
DROP TRIGGER IF EXISTS items_search_after_update;
DROP TRIGGER IF EXISTS items_search_after_delete;
DROP TABLE IF EXISTS item_search_exact;
DROP TABLE IF EXISTS item_search_title_trigram;
`;

export const CREATE_ITEM_SEARCH_INDEX_SQL = `
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
DELETE FROM item_search_exact;
DELETE FROM item_search_title_trigram;
INSERT INTO item_search_exact(rowid, item_id, title, content_text)
SELECT
  rowid,
  id,
  COALESCE(json_extract(data, '$.title'), ''),
  content_text
FROM items
WHERE status != 3;
INSERT INTO item_search_title_trigram(rowid, item_id, title)
SELECT
  rowid,
  id,
  COALESCE(json_extract(data, '$.title'), '')
FROM items
WHERE status != 3;
`;
