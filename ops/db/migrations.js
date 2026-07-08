/**
 * Idempotent column migrations for tables that already exist in a deployed DB.
 *
 * `ops/db/init.sql` creates tables with `CREATE TABLE IF NOT EXISTS`, which
 * does NOT add columns to a table that already exists. When we add a column to
 * an existing table, we must ALTER it here. Each statement is run on its own
 * and its failure is tolerated:
 *   - "duplicate column name" — already applied (later deploys).
 *   - "no such table"        — brand-new DB; init.sql creates the full table.
 *
 * Applied BEFORE init.sql on every deploy so init.sql's indexes on the new
 * columns succeed against previously-created tables.
 */
const MEDIA_MIGRATIONS = [
  "ALTER TABLE media ADD COLUMN title VARCHAR(255)",
  "ALTER TABLE media ADD COLUMN slug VARCHAR(255)",
  "ALTER TABLE media ADD COLUMN original_filename VARCHAR(255)",
];

const MIGRATIONS = [
  ...MEDIA_MIGRATIONS,
];

module.exports = {MIGRATIONS, MEDIA_MIGRATIONS};
