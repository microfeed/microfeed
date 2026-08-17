CREATE TABLE IF NOT EXISTS webhook_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  daily_delivery_limit INTEGER NOT NULL DEFAULT 1000
    CHECK (daily_delivery_limit BETWEEN 0 AND 1000000),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO webhook_settings (id, daily_delivery_limit)
VALUES (1, 1000)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS webhook_event_reserve_budget;
DROP TRIGGER IF EXISTS webhook_reservation_reserve_budget;

ALTER TABLE webhook_daily_usage RENAME TO webhook_daily_usage_legacy;

CREATE TABLE webhook_daily_usage (
  usage_day TEXT PRIMARY KEY,
  deliveries INTEGER NOT NULL DEFAULT 0 CHECK (deliveries >= 0),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO webhook_daily_usage (usage_day, deliveries, updated_at)
SELECT usage_day, deliveries, updated_at
FROM webhook_daily_usage_legacy;

DROP TABLE webhook_daily_usage_legacy;

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

CREATE TRIGGER webhook_reservation_reserve_budget
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
    AND deliveries + NEW.delivery_count <= COALESCE(
      (SELECT daily_delivery_limit FROM webhook_settings WHERE id = 1),
      1000
    );

  SELECT (CASE WHEN changes() = 0
    THEN RAISE(ABORT, 'webhook_daily_budget') END);
END;
