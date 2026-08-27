PRAGMA defer_foreign_keys = true;

DROP TRIGGER IF EXISTS webhook_event_reserve_budget;
DROP INDEX IF EXISTS webhook_events_created;
DROP INDEX IF EXISTS webhook_events_subject;
DROP INDEX IF EXISTS webhook_deliveries_created;
DROP INDEX IF EXISTS webhook_deliveries_endpoint;
DROP INDEX IF EXISTS webhook_deliveries_reconcile;
DROP INDEX IF EXISTS webhook_delivery_attempts_delivery;

ALTER TABLE webhook_delivery_attempts
RENAME TO webhook_delivery_attempts_legacy;
ALTER TABLE webhook_deliveries RENAME TO webhook_deliveries_legacy;
ALTER TABLE webhook_events RENAME TO webhook_events_legacy;

CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  api_version TEXT NOT NULL DEFAULT '1',
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  origin TEXT NOT NULL
    CHECK (origin IN ('dashboard', 'api', 'system', 'webmcp')),
  request_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  delivery_count INTEGER NOT NULL DEFAULT 0,
  budget_day TEXT NOT NULL,
  suppression_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO webhook_events (
  id, event_type, api_version, subject_type, subject_id, payload_json,
  origin, request_id, correlation_id, causation_id, delivery_count,
  budget_day, suppression_reason, created_at
)
SELECT
  id, event_type, api_version, subject_type, subject_id, payload_json,
  origin, request_id, correlation_id, causation_id, delivery_count,
  budget_day, suppression_reason, created_at
FROM webhook_events_legacy;

CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'retrying', 'succeeded', 'failed',
    'suppressed_budget', 'suppressed_endpoint_paused',
    'canceled_endpoint_paused', 'canceled_endpoint_disabled',
    'canceled_webhooks_disabled'
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

INSERT INTO webhook_deliveries (
  id, event_id, endpoint_id, endpoint_url, status, attempt_count, is_test,
  is_manual, queued_at, next_attempt_at, lease_until, response_status,
  response_body, error, completed_at, created_at, updated_at
)
SELECT
  id, event_id, endpoint_id, endpoint_url, status, attempt_count, is_test,
  is_manual, queued_at, next_attempt_at, lease_until, response_status,
  response_body, error, completed_at, created_at, updated_at
FROM webhook_deliveries_legacy;

CREATE TABLE webhook_delivery_attempts (
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

INSERT INTO webhook_delivery_attempts (
  id, delivery_id, attempt_number, outcome, response_status, response_body,
  error, duration_ms, created_at
)
SELECT
  id, delivery_id, attempt_number, outcome, response_status, response_body,
  error, duration_ms, created_at
FROM webhook_delivery_attempts_legacy;

DROP TABLE webhook_delivery_attempts_legacy;
DROP TABLE webhook_deliveries_legacy;
DROP TABLE webhook_events_legacy;

CREATE INDEX webhook_events_created
ON webhook_events (created_at DESC, id DESC);
CREATE INDEX webhook_events_subject
ON webhook_events (subject_type, subject_id, created_at DESC);
CREATE INDEX webhook_deliveries_created
ON webhook_deliveries (created_at DESC, id DESC);
CREATE INDEX webhook_deliveries_endpoint
ON webhook_deliveries (endpoint_id, created_at DESC);
CREATE INDEX webhook_deliveries_reconcile
ON webhook_deliveries (status, queued_at, next_attempt_at, lease_until);
CREATE INDEX webhook_delivery_attempts_delivery
ON webhook_delivery_attempts (delivery_id, attempt_number);

CREATE TRIGGER webhook_event_reserve_budget
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
    AND deliveries + NEW.delivery_count <= COALESCE(
      (SELECT daily_delivery_limit FROM webhook_settings WHERE id = 1),
      1000
    );

  SELECT (CASE WHEN changes() = 0
    THEN RAISE(ABORT, 'webhook_daily_budget') END);
END;
