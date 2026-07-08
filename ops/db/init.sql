CREATE TABLE IF NOT EXISTS channels (
  id VARCHAR(11) PRIMARY KEY,

  status TINYINT,   /* 1: PUBLISHED, 2: UNPUBLISHED, 3: DELETED */
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
  status TINYINT, /* 1: PUBLISHED, 2: UNPUBLISHED, 3: DELETED */
  data TEXT,
  content_type VARCHAR(50),
  slug VARCHAR(255),
  pub_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS items_pub_date on items (pub_date);
CREATE INDEX IF NOT EXISTS items_created_at on items (created_at);
CREATE INDEX IF NOT EXISTS items_updated_at on items (updated_at);
CREATE INDEX IF NOT EXISTS items_status on items (status);
CREATE UNIQUE INDEX IF NOT EXISTS items_content_type_slug on items (content_type, slug);

CREATE TABLE IF NOT EXISTS settings (
  category VARCHAR(20) PRIMARY KEY,
  data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR(11) PRIMARY KEY,
  slug VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS tags_slug on tags (slug);

CREATE TABLE IF NOT EXISTS item_tags (
  item_id VARCHAR(11) NOT NULL,
  tag_id VARCHAR(11) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS item_tags_item_id_tag_id on item_tags (item_id, tag_id);
CREATE INDEX IF NOT EXISTS item_tags_tag_id on item_tags (tag_id);

CREATE TABLE IF NOT EXISTS item_relations (
  parent_item_id VARCHAR(11) NOT NULL,
  child_item_id VARCHAR(11) NOT NULL,
  rel_type VARCHAR(50) NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (child_item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS item_relations_parent_item_id_rel_type_child_item_id on item_relations (parent_item_id, rel_type, child_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS item_relations_parent_item_id_rel_type_position on item_relations (parent_item_id, rel_type, position);
CREATE INDEX IF NOT EXISTS item_relations_child_item_id on item_relations (child_item_id);

CREATE TABLE IF NOT EXISTS media (
  id VARCHAR(11) PRIMARY KEY,
  r2_key VARCHAR(1024) NOT NULL,
  url VARCHAR(1024) NOT NULL,
  title VARCHAR(255),
  slug VARCHAR(255),
  original_filename VARCHAR(255),
  content_hash VARCHAR(64),
  size INTEGER,
  content_type VARCHAR(100),
  category VARCHAR(20) DEFAULT 'image',
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS media_r2_key on media (r2_key);
CREATE UNIQUE INDEX IF NOT EXISTS media_slug on media (slug);
CREATE INDEX IF NOT EXISTS media_content_hash on media (content_hash);
CREATE INDEX IF NOT EXISTS media_created_at on media (created_at);
