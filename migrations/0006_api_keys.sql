CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  api_key TEXT NOT NULL UNIQUE,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_api_key ON api_keys (api_key);

WITH legacy_api_keys AS (
  SELECT
    CAST(application.key AS INTEGER) AS position,
    application.value AS application,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000 AS migration_time_ms
  FROM settings
  JOIN json_each(
    CASE
      WHEN json_valid(settings.data) THEN settings.data
      ELSE '{}'
    END,
    '$.apps'
  ) AS application
  WHERE settings.category = 'apiSettings'
    AND json_type(application.value) = 'object'
),
normalized_api_keys AS (
  SELECT
    CASE
      WHEN typeof(json_extract(application, '$.id')) = 'text'
        AND trim(json_extract(application, '$.id')) != ''
      THEN trim(json_extract(application, '$.id'))
      ELSE 'legacy-api-key-' || printf('%04d', position)
    END AS id,
    CASE
      WHEN typeof(json_extract(application, '$.name')) = 'text'
        AND trim(json_extract(application, '$.name')) != ''
      THEN trim(json_extract(application, '$.name'))
      ELSE 'Legacy API key ' || (position + 1)
    END AS name,
    trim(json_extract(application, '$.token')) AS api_key,
    CASE
      WHEN typeof(json_extract(application, '$.createdAtMs')) IN ('integer', 'real')
        AND json_extract(application, '$.createdAtMs') > 0
      THEN CAST(json_extract(application, '$.createdAtMs') AS INTEGER)
      ELSE migration_time_ms
    END AS created_at_ms,
    position
  FROM legacy_api_keys
  WHERE typeof(json_extract(application, '$.token')) = 'text'
    AND trim(json_extract(application, '$.token')) != ''
),
deduplicated_api_keys AS (
  SELECT
    id,
    CASE
      WHEN count(*) OVER (PARTITION BY lower(name)) > 1
      THEN name || ' (' || id || ')'
      ELSE name
    END AS name,
    api_key,
    created_at_ms,
    position,
    row_number() OVER (
      PARTITION BY api_key
      ORDER BY position ASC, id ASC
    ) AS api_key_position
  FROM normalized_api_keys
)
INSERT OR IGNORE INTO api_keys (
  id,
  name,
  api_key,
  created_at_ms,
  updated_at_ms
)
SELECT
  id,
  name,
  api_key,
  created_at_ms,
  created_at_ms
FROM deduplicated_api_keys
WHERE api_key_position = 1
ORDER BY position ASC, id ASC;
