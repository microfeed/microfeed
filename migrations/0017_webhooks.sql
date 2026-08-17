CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'auto_paused')),
  secret_ciphertext TEXT NOT NULL,
  previous_secret_ciphertext TEXT,
  previous_secret_expires_at TIMESTAMP,
  consecutive_terminal_failures INTEGER NOT NULL DEFAULT 0,
  resume_tested_at TIMESTAMP,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS webhook_endpoints_status
ON webhook_endpoints (status, deleted_at, updated_at);

CREATE TRIGGER IF NOT EXISTS webhook_endpoint_limit_insert
BEFORE INSERT ON webhook_endpoints
WHEN NEW.deleted_at IS NULL AND (
  SELECT COUNT(*) FROM webhook_endpoints WHERE deleted_at IS NULL
) >= 20
BEGIN
  SELECT RAISE(ABORT, 'webhook_endpoint_limit');
END;

CREATE TRIGGER IF NOT EXISTS webhook_endpoint_limit_restore
BEFORE UPDATE OF deleted_at ON webhook_endpoints
WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL AND (
  SELECT COUNT(*) FROM webhook_endpoints WHERE deleted_at IS NULL
) >= 20
BEGIN
  SELECT RAISE(ABORT, 'webhook_endpoint_limit');
END;

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  endpoint_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (endpoint_id, event_type),
  FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS webhook_subscriptions_event
ON webhook_subscriptions (event_type, endpoint_id);

CREATE TABLE IF NOT EXISTS webhook_daily_usage (
  usage_day TEXT PRIMARY KEY,
  deliveries INTEGER NOT NULL DEFAULT 0 CHECK (deliveries BETWEEN 0 AND 1000),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  api_version TEXT NOT NULL DEFAULT '1',
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('dashboard', 'api', 'system')),
  request_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  delivery_count INTEGER NOT NULL DEFAULT 0,
  budget_day TEXT NOT NULL,
  suppression_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS webhook_events_created
ON webhook_events (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS webhook_events_subject
ON webhook_events (subject_type, subject_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS webhook_event_reserve_budget
BEFORE INSERT ON webhook_events
WHEN NEW.delivery_count > 0
BEGIN
  INSERT INTO webhook_daily_usage (usage_day, deliveries, updated_at)
  VALUES (NEW.budget_day, 0, CURRENT_TIMESTAMP)
  ON CONFLICT (usage_day) DO NOTHING;

  UPDATE webhook_daily_usage
  SET deliveries = deliveries + NEW.delivery_count,
      updated_at = CURRENT_TIMESTAMP
  WHERE usage_day = NEW.budget_day
    AND deliveries + NEW.delivery_count <= 1000;

  SELECT CASE WHEN changes() = 0
    THEN RAISE(ABORT, 'webhook_daily_budget') END;
END;

CREATE TABLE IF NOT EXISTS webhook_budget_reservations (
  id TEXT PRIMARY KEY,
  delivery_count INTEGER NOT NULL,
  budget_day TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS webhook_reservation_reserve_budget
BEFORE INSERT ON webhook_budget_reservations
WHEN NEW.delivery_count > 0
BEGIN
  INSERT INTO webhook_daily_usage (usage_day, deliveries, updated_at)
  VALUES (NEW.budget_day, 0, CURRENT_TIMESTAMP)
  ON CONFLICT (usage_day) DO NOTHING;

  UPDATE webhook_daily_usage
  SET deliveries = deliveries + NEW.delivery_count,
      updated_at = CURRENT_TIMESTAMP
  WHERE usage_day = NEW.budget_day
    AND deliveries + NEW.delivery_count <= 1000;

  SELECT CASE WHEN changes() = 0
    THEN RAISE(ABORT, 'webhook_daily_budget') END;
END;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'retrying', 'succeeded', 'failed',
    'suppressed_budget', 'suppressed_endpoint_paused',
    'canceled_endpoint_paused', 'canceled_endpoint_disabled'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  is_test BOOLEAN NOT NULL DEFAULT 0,
  is_manual BOOLEAN NOT NULL DEFAULT 0,
  queued_at TIMESTAMP,
  next_attempt_at TIMESTAMP,
  lease_until TIMESTAMP,
  response_status INTEGER,
  response_body TEXT,
  error TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES webhook_events(id),
  FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints(id)
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_created
ON webhook_deliveries (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint
ON webhook_deliveries (endpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_reconcile
ON webhook_deliveries (status, queued_at, next_attempt_at, lease_until);

CREATE TABLE IF NOT EXISTS webhook_delivery_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  error TEXT,
  duration_ms INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_id) REFERENCES webhook_deliveries(id)
);

CREATE INDEX IF NOT EXISTS webhook_delivery_attempts_delivery
ON webhook_delivery_attempts (delivery_id, attempt_number);

CREATE TABLE IF NOT EXISTS webhook_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS webhook_alerts_open
ON webhook_alerts (resolved_at, created_at DESC);
