CREATE TABLE IF NOT EXISTS channels (
  id VARCHAR(11) PRIMARY KEY,

  status TINYINT,   /* 1: PUBLISHED, 2: UNPUBLISHED, 3: ARCHIVED */
  is_primary BOOLEAN UNIQUE,  /* True or NULL*/
  data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS channels_status on channels (status);
CREATE INDEX IF NOT EXISTS channels_is_primary on channels (is_primary);
CREATE INDEX IF NOT EXISTS channels_created_at on channels (created_at);
CREATE INDEX IF NOT EXISTS channels_updated_at on channels (updated_at);

CREATE TABLE IF NOT EXISTS items (
  id VARCHAR(11) PRIMARY KEY,
  status TINYINT, /* 1: PUBLISHED, 2: UNPUBLISHED, 3: ARCHIVED */
  type_id INTEGER,
  primary_category_id INTEGER,
  secondary_category_id INTEGER,
  itunes_series_id INTEGER,
  slug VARCHAR(120),
  seo_title TEXT,
  seo_description TEXT,
  canonical_url TEXT,
  noindex BOOLEAN,
  og_image TEXT,
  data TEXT,
  pub_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS items_pub_date on items (pub_date);
CREATE INDEX IF NOT EXISTS items_created_at on items (created_at);
CREATE INDEX IF NOT EXISTS items_updated_at on items (updated_at);
CREATE INDEX IF NOT EXISTS items_status on items (status);
CREATE INDEX IF NOT EXISTS items_type_id on items (type_id);
CREATE INDEX IF NOT EXISTS items_primary_category_id on items (primary_category_id);
CREATE INDEX IF NOT EXISTS items_secondary_category_id on items (secondary_category_id);
CREATE INDEX IF NOT EXISTS items_itunes_series_id on items (itunes_series_id);
CREATE INDEX IF NOT EXISTS items_slug on items (slug);

CREATE TABLE IF NOT EXISTS settings (
  category VARCHAR(20) PRIMARY KEY,
  data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS categories_parent_id on categories (parent_id);
CREATE INDEX IF NOT EXISTS categories_slug on categories (slug);

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
