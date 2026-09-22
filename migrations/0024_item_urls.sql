-- Paths are durable, unlike derived search indexes. Old writers leave these
-- columns intact. NULL paths are backfilled before and after deployment.
ALTER TABLE items ADD COLUMN public_path TEXT;
ALTER TABLE items ADD COLUMN url_mode TEXT NOT NULL DEFAULT 'legacy'
  CHECK (url_mode IN ('legacy', 'auto', 'custom'));
ALTER TABLE items ADD COLUMN url_frozen INTEGER NOT NULL DEFAULT 1;
ALTER TABLE items ADD COLUMN url_revision INTEGER NOT NULL DEFAULT 0 CHECK (url_revision >= 0);
CREATE UNIQUE INDEX items_public_path ON items(public_path);
CREATE INDEX items_missing_path ON items(id) WHERE public_path IS NULL;

CREATE TABLE item_paths (
  path TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  was_public INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX item_paths_owner ON item_paths(item_id);

-- No foreign key: deleting an item must never free its public URLs or ID.
INSERT INTO item_paths(path, item_id, was_public)
SELECT '/i/' || id || '/', id, 1 FROM items;

CREATE TRIGGER items_reserve_id AFTER INSERT ON items BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM item_paths WHERE path = '/i/' || NEW.id || '/' AND item_id != NEW.id
  ) THEN RAISE(ABORT, 'item_path_conflict') END;
  INSERT OR IGNORE INTO item_paths(path, item_id, was_public)
  VALUES ('/i/' || NEW.id || '/', NEW.id, 1);
END;

CREATE TRIGGER items_reserve_path AFTER UPDATE OF public_path, status ON items
WHEN NEW.public_path IS NOT NULL BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM item_paths WHERE path = NEW.public_path AND item_id != NEW.id
  ) OR (
    (length(NEW.public_path) = 15 OR substr(NEW.public_path, -13, 1) = '-') AND EXISTS (
      SELECT 1 FROM item_paths
      WHERE path = '/i/' || substr(NEW.public_path, -12, 11) || '/' AND item_id != NEW.id
    )
  ) THEN RAISE(ABORT, 'item_path_conflict') END;
  INSERT INTO item_paths(path, item_id, was_public)
  VALUES (NEW.public_path, NEW.id, CASE WHEN NEW.status IN (1, 4) THEN 1 ELSE 0 END)
  ON CONFLICT(path) DO UPDATE SET was_public = max(was_public, excluded.was_public);
  -- Unpublished automatic title edits need no redirect history.
  DELETE FROM item_paths WHERE path = OLD.public_path AND path != NEW.public_path
    AND item_id = NEW.id AND was_public = 0 AND OLD.url_mode = 'auto';
END;

CREATE TRIGGER items_freeze_public_url AFTER UPDATE OF status ON items
WHEN NEW.status IN (1, 4) AND NEW.url_frozen = 0 BEGIN
  UPDATE items SET url_frozen = 1, url_revision = url_revision + 1 WHERE id = NEW.id;
END;

CREATE TRIGGER items_reserve_inserted_path AFTER INSERT ON items
WHEN NEW.public_path IS NOT NULL BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM item_paths WHERE path = NEW.public_path AND item_id != NEW.id
  ) OR (
    (length(NEW.public_path) = 15 OR substr(NEW.public_path, -13, 1) = '-') AND EXISTS (
      SELECT 1 FROM item_paths
      WHERE path = '/i/' || substr(NEW.public_path, -12, 11) || '/' AND item_id != NEW.id
    )
  ) THEN RAISE(ABORT, 'item_path_conflict') END;
  INSERT INTO item_paths(path, item_id, was_public)
  VALUES (NEW.public_path, NEW.id, CASE WHEN NEW.status IN (1, 4) THEN 1 ELSE 0 END)
  ON CONFLICT(path) DO UPDATE SET was_public = max(was_public, excluded.was_public);
END;

-- A deployment backfill must never freeze the title read before an old writer's
-- concurrent edit, even if both writes have the same timestamp.
CREATE TRIGGER items_pending_path_revision AFTER UPDATE OF data ON items
WHEN NEW.public_path IS NULL AND json_extract(OLD.data, '$.title') IS NOT json_extract(NEW.data, '$.title') BEGIN
  UPDATE items SET url_revision = url_revision + 1 WHERE id = NEW.id;
END;
