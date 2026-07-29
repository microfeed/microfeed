CREATE TABLE IF NOT EXISTS channels (
  id VARCHAR(11) PRIMARY KEY,
  status TINYINT,
  is_primary BOOLEAN UNIQUE,
  data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS channels_status ON channels (status);
CREATE INDEX IF NOT EXISTS channels_is_primary ON channels (is_primary);
CREATE INDEX IF NOT EXISTS channels_created_at ON channels (created_at);
CREATE INDEX IF NOT EXISTS channels_updated_at ON channels (updated_at);

CREATE TABLE IF NOT EXISTS items (
  id VARCHAR(11) PRIMARY KEY,
  status TINYINT,
  data TEXT,
  pub_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS items_pub_date ON items (pub_date);
CREATE INDEX IF NOT EXISTS items_created_at ON items (created_at);
CREATE INDEX IF NOT EXISTS items_updated_at ON items (updated_at);
CREATE INDEX IF NOT EXISTS items_status ON items (status);

CREATE TABLE IF NOT EXISTS settings (
  category VARCHAR(20) PRIMARY KEY,
  data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
