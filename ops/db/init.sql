CREATE TABLE IF NOT EXISTS channels (
  id VARCHAR(11) PRIMARY KEY,

  status TINYINT,   /* 1: PUBLISHED, 2: UNPUBLISHED, 3: DELETED */
  channel_type TINYINT, /* 1: PRIMARY, 2: SECONDARY */
  data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS channels_status on channels (status);
CREATE INDEX IF NOT EXISTS channels_channel_type on channels (channel_type);
CREATE INDEX IF NOT EXISTS channels_created_at on channels (created_at);
CREATE INDEX IF NOT EXISTS channels_updated_at on channels (updated_at);

CREATE TABLE IF NOT EXISTS items (
  id VARCHAR(11) PRIMARY KEY,
  status TINYINT, /* 1: PUBLISHED, 2: UNPUBLISHED, 3: DELETED */
  data TEXT,
  pub_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS items_pub_date on items (pub_date);
CREATE INDEX IF NOT EXISTS items_created_at on items (created_at);
CREATE INDEX IF NOT EXISTS items_updated_at on items (updated_at);
CREATE INDEX IF NOT EXISTS items_status on items (status);

CREATE TABLE IF NOT EXISTS settings (
  category VARCHAR(20) PRIMARY KEY,
  data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
