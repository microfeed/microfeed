const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const {MEDIA_MIGRATIONS} = require("./migrations");

// The media table as it shipped in the FIRST media-manager deploy — before
// title/slug/original_filename existed. Reproduces the deployed production DB.
const OLD_MEDIA_SCHEMA = `
CREATE TABLE media (
  id VARCHAR(11) PRIMARY KEY,
  r2_key VARCHAR(1024) NOT NULL,
  url VARCHAR(1024) NOT NULL,
  content_hash VARCHAR(64),
  size INTEGER,
  content_type VARCHAR(100),
  category VARCHAR(20) DEFAULT 'image',
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX media_r2_key on media (r2_key);
CREATE INDEX media_content_hash on media (content_hash);
CREATE INDEX media_created_at on media (created_at);
`;

function columns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name);
}
function indexes(db, table) {
  return db.prepare(`PRAGMA index_list(${table})`).all().map((r) => r.name);
}

// Apply migrations the way the deploy does: each statement on its own,
// tolerating the expected "duplicate column"/"no such table" failures.
function applyMigrations(db) {
  MEDIA_MIGRATIONS.forEach((sql) => {
    try {
      db.exec(sql);
    } catch (e) {
      // Tolerated — mirrors the deploy's per-statement error swallowing.
    }
  });
}

describe("media column migrations", () => {
  test("upgrade an existing pre-slug media table, then init.sql runs cleanly", () => {
    const db = new Database(":memory:");
    try {
      db.exec(OLD_MEDIA_SCHEMA);
      expect(columns(db, "media")).not.toContain("slug");

      applyMigrations(db);

      expect(columns(db, "media")).toEqual(expect.arrayContaining([
        "title", "slug", "original_filename",
      ]));

      // init.sql must now run without "no such column: slug" and create the
      // new unique index against the migrated table.
      const initSql = fs.readFileSync(path.join(__dirname, "init.sql"), "utf8");
      expect(() => db.exec(initSql)).not.toThrow();
      expect(indexes(db, "media")).toEqual(expect.arrayContaining(["media_slug"]));
    } finally {
      db.close();
    }
  });

  test("migrations are safe to re-run (idempotent by tolerance)", () => {
    const db = new Database(":memory:");
    try {
      const initSql = fs.readFileSync(path.join(__dirname, "init.sql"), "utf8");
      db.exec(initSql); // fresh DB already has the columns

      // Re-running the ADD COLUMN statements would throw "duplicate column";
      // the tolerant runner swallows it and leaves the schema intact.
      expect(() => applyMigrations(db)).not.toThrow();
      expect(columns(db, "media")).toEqual(expect.arrayContaining([
        "title", "slug", "original_filename",
      ]));
    } finally {
      db.close();
    }
  });

  test("migrations tolerate a brand-new DB with no media table yet", () => {
    const db = new Database(":memory:");
    try {
      expect(() => applyMigrations(db)).not.toThrow();
      // init.sql then creates the full table.
      const initSql = fs.readFileSync(path.join(__dirname, "init.sql"), "utf8");
      expect(() => db.exec(initSql)).not.toThrow();
      expect(columns(db, "media")).toEqual(expect.arrayContaining(["title", "slug", "original_filename"]));
    } finally {
      db.close();
    }
  });
});
