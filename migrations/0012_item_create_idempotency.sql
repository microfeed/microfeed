CREATE TABLE IF NOT EXISTS item_create_idempotency (
  key_hash TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  item_id VARCHAR(11) NOT NULL UNIQUE,
  created_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS item_create_idempotency_created_at
ON item_create_idempotency (created_at_ms);
