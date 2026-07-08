const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function getTableColumns(db, tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => row.name);
}

function getIndexNames(db, tableName) {
  return db.prepare(`PRAGMA index_list(${tableName})`).all().map((row) => row.name);
}

function getForeignKeys(db, tableName) {
  return db.prepare(`PRAGMA foreign_key_list(${tableName})`).all().map((row) => ({
    table: row.table,
    from: row.from,
    to: row.to,
    onDelete: row.on_delete,
  }));
}

describe("ops/db/init.sql", () => {
  test("declares the Phase 0 schema", () => {
    const db = new Database(":memory:");
    try {
      const initSql = fs.readFileSync(path.join(__dirname, "init.sql"), "utf8");
      db.exec(initSql);

      const tableNames = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all().map((row) => row.name);
      expect(tableNames).toEqual([
        "channels",
        "item_relations",
        "item_tags",
        "items",
        "media",
        "settings",
        "tags",
      ]);

      expect(getTableColumns(db, "items")).toEqual(expect.arrayContaining([
        "id",
        "status",
        "data",
        "content_type",
        "slug",
        "pub_date",
        "created_at",
        "updated_at",
      ]));
      expect(getIndexNames(db, "items")).toEqual(expect.arrayContaining([
        "items_pub_date",
        "items_created_at",
        "items_updated_at",
        "items_status",
        "items_content_type_slug",
      ]));

      expect(getTableColumns(db, "tags")).toEqual(expect.arrayContaining([
        "id",
        "slug",
        "name",
        "created_at",
        "updated_at",
      ]));
      expect(getIndexNames(db, "tags")).toEqual(expect.arrayContaining([
        "tags_slug",
      ]));

      expect(getTableColumns(db, "item_tags")).toEqual(expect.arrayContaining([
        "item_id",
        "tag_id",
        "created_at",
        "updated_at",
      ]));
      expect(getIndexNames(db, "item_tags")).toEqual(expect.arrayContaining([
        "item_tags_item_id_tag_id",
        "item_tags_tag_id",
      ]));
      expect(getForeignKeys(db, "item_tags")).toEqual(expect.arrayContaining([
        {table: "items", from: "item_id", to: "id", onDelete: "CASCADE"},
        {table: "tags", from: "tag_id", to: "id", onDelete: "CASCADE"},
      ]));

      expect(getTableColumns(db, "item_relations")).toEqual(expect.arrayContaining([
        "parent_item_id",
        "child_item_id",
        "rel_type",
        "position",
        "created_at",
        "updated_at",
      ]));
      expect(getIndexNames(db, "item_relations")).toEqual(expect.arrayContaining([
        "item_relations_parent_item_id_rel_type_child_item_id",
        "item_relations_parent_item_id_rel_type_position",
        "item_relations_child_item_id",
      ]));
      expect(getForeignKeys(db, "item_relations")).toEqual(expect.arrayContaining([
        {table: "items", from: "parent_item_id", to: "id", onDelete: "CASCADE"},
        {table: "items", from: "child_item_id", to: "id", onDelete: "CASCADE"},
      ]));

      expect(getTableColumns(db, "media")).toEqual(expect.arrayContaining([
        "id",
        "r2_key",
        "url",
        "title",
        "slug",
        "original_filename",
        "content_hash",
        "size",
        "content_type",
        "category",
        "width",
        "height",
        "created_at",
        "updated_at",
      ]));
      expect(getIndexNames(db, "media")).toEqual(expect.arrayContaining([
        "media_r2_key",
        "media_slug",
        "media_content_hash",
        "media_created_at",
      ]));
    } finally {
      db.close();
    }
  });
});
