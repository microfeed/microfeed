export const SITE_SEARCH_VIRTUAL_TABLE_PREFIXES = [
  "site_search_exact",
  "site_search_title_trigram",
] as const;

// Compatibility export used by portable-snapshot code. Search now covers
// both feed items and Pages, but these tables remain derived and disposable.
export const ITEM_SEARCH_VIRTUAL_TABLE_PREFIXES = [
  ...SITE_SEARCH_VIRTUAL_TABLE_PREFIXES,
  "item_search_exact",
  "item_search_title_trigram",
] as const;

export const DROP_SITE_SEARCH_INDEX_SQL = `
UPDATE site_search_metadata
SET ready = 0, normalized_at = NULL
WHERE id = 1;
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
`;

export const CREATE_SITE_SEARCH_INDEX_SQL = `
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
INSERT INTO site_search_documents (
  content_type, content_id, status, title, content_text,
  published_at, updated_at, image
)
SELECT
  'page', id, status, title, content_text,
  published_at, updated_at, NULL
FROM pages
WHERE status != 3;
`;

// Keep the old names while deployment and snapshot callers migrate. Their
// behavior now prepares the unified site search corpus.
export const DROP_ITEM_SEARCH_INDEX_SQL = DROP_SITE_SEARCH_INDEX_SQL;
export const CREATE_ITEM_SEARCH_INDEX_SQL = CREATE_SITE_SEARCH_INDEX_SQL;
