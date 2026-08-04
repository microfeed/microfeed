-- SQLite's CURRENT_TIMESTAMP uses `YYYY-MM-DD HH:MM:SS`, while application
-- updates use RFC 3339. Keyset pagination compares these indexed TEXT values,
-- so normalize legacy rows to one lexicographically sortable representation.
UPDATE "items"
SET
  "created_at" = COALESCE(
    strftime('%Y-%m-%dT%H:%M:%fZ', "created_at"),
    "created_at"
  ),
  "updated_at" = COALESCE(
    strftime('%Y-%m-%dT%H:%M:%fZ', "updated_at"),
    "updated_at"
  )
WHERE
  instr("created_at", 'T') = 0 OR
  instr("updated_at", 'T') = 0;
