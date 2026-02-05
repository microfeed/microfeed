-- Add new columns to items
ALTER TABLE items ADD COLUMN type_id INTEGER;
ALTER TABLE items ADD COLUMN primary_category_id INTEGER;
ALTER TABLE items ADD COLUMN secondary_category_id INTEGER;
ALTER TABLE items ADD COLUMN itunes_series_id INTEGER;
ALTER TABLE items ADD COLUMN slug VARCHAR(120);
ALTER TABLE items ADD COLUMN seo_title TEXT;
ALTER TABLE items ADD COLUMN seo_description TEXT;
ALTER TABLE items ADD COLUMN canonical_url TEXT;
ALTER TABLE items ADD COLUMN noindex BOOLEAN;
ALTER TABLE items ADD COLUMN og_image TEXT;

-- New tables
CREATE TABLE IF NOT EXISTS item_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  parent_id INTEGER,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(parent_id, slug)
);

CREATE TABLE IF NOT EXISTS site_seo (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  site_name TEXT,
  default_title TEXT,
  default_description TEXT,
  default_og_image TEXT,
  twitter_handle TEXT,
  logo_url TEXT,
  language TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itunes_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  description TEXT,
  image TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS items_type_id on items (type_id);
CREATE INDEX IF NOT EXISTS items_primary_category_id on items (primary_category_id);
CREATE INDEX IF NOT EXISTS items_secondary_category_id on items (secondary_category_id);
CREATE INDEX IF NOT EXISTS items_itunes_series_id on items (itunes_series_id);
CREATE INDEX IF NOT EXISTS items_slug on items (slug);
CREATE INDEX IF NOT EXISTS categories_parent_id on categories (parent_id);
CREATE INDEX IF NOT EXISTS categories_slug on categories (slug);

-- Seed item types
INSERT OR IGNORE INTO item_types (name, slug, description, sort_order) VALUES ('Podcast', 'podcast', '', 1);
INSERT OR IGNORE INTO item_types (name, slug, description, sort_order) VALUES ('Video', 'video', '', 2);
INSERT OR IGNORE INTO item_types (name, slug, description, sort_order) VALUES ('Blog Post', 'blog-post', '', 3);
INSERT OR IGNORE INTO item_types (name, slug, description, sort_order) VALUES ('Static Page', 'static-page', '', 4);

-- Seed site SEO row
INSERT OR IGNORE INTO site_seo (id, site_name, default_title, default_description, default_og_image, twitter_handle, logo_url, language)
VALUES (1, '', '', '', '', '', '', '');

-- Backfill existing items to Podcast
UPDATE items
SET type_id = (SELECT id FROM item_types WHERE slug = 'podcast' LIMIT 1)
WHERE type_id IS NULL;
