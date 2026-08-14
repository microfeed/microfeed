-- Personal-site categories: a managed list of categories assignable to items.
-- An item can carry at most MAX_CATEGORIES_PER_ITEM (2) categories, enforced
-- in application code (see src/shared/Categories.ts and the categories service).

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS item_categories (
  item_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, category_id)
);

CREATE INDEX IF NOT EXISTS item_categories_item_id
ON item_categories (item_id);
CREATE INDEX IF NOT EXISTS item_categories_category_id
ON item_categories (category_id);
