import {DatabaseSync} from "node:sqlite";
import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";
import {unstable_splitSqlQuery} from "wrangler";
import {prepareItemUrls} from "../../manage-cli/lib/item-urls";
import type {CloudflareClient} from "../../manage-cli/lib/cloudflare";
import type {MicrofeedConfig} from "../../manage-cli/types";
import {buildRestoreSql, SNAPSHOT_TABLES} from "../../manage-cli/lib/snapshot";
import {legacyItemPath, normalizeItemSlug} from "@/shared/ItemUrls";

const config = {} as MicrofeedConfig;
async function fixture() {
  const db = new DatabaseSync(":memory:");
  for (const name of ["0001_initial", "0024_item_urls"]) {
    const sql = await readFile(new URL(`../../migrations/${name}.sql`, import.meta.url), "utf8");
    // Exercise the individual statements Wrangler sends to local D1. exec()
    // accepts multiple statements and would hide incorrectly combined triggers.
    for (const statement of unstable_splitSqlQuery(sql)) db.prepare(statement).run();
  }
  db.prepare("INSERT INTO items(id,status,data) VALUES(?,1,?)").run("migration01", JSON.stringify({title: "Original 中文"}));
  const client = {async queryD1(_config: MicrofeedConfig, sql: string) { return db.prepare(sql).all(); }} as CloudflareClient;
  return {db, client};
}

describe("durable item URL preparation", () => {
  it("reserves inserted URLs and freezes them on publication after Wrangler splits the migration", async () => {
    const {db} = await fixture();
    try {
      db.exec("INSERT INTO items(id,status,data,public_path,url_mode,url_frozen) VALUES('draftitem01',2,'{}','/i/draft/','auto',0)");
      expect(db.prepare("SELECT was_public FROM item_paths WHERE path='/i/draft/'").get()).toEqual({was_public: 0});
      db.exec("UPDATE items SET status=1 WHERE id='draftitem01'");
      expect(db.prepare("SELECT url_frozen,url_revision FROM items WHERE id='draftitem01'").get()).toEqual({url_frozen: 1, url_revision: 1});
      expect(db.prepare("SELECT was_public FROM item_paths WHERE path='/i/draft/'").get()).toEqual({was_public: 1});

      db.exec("INSERT INTO items(id,status,data,public_path) VALUES('nullstate01',NULL,'{}','/i/null-status/')");
      expect(db.prepare("SELECT was_public FROM item_paths WHERE path='/i/null-status/'").get()).toEqual({was_public: 0});
      db.exec("DELETE FROM items WHERE id='draftitem01'");
      expect(() => db.exec("INSERT INTO items(id,status,data,public_path) VALUES('conflict001',1,'{}','/i/draft/')"))
        .toThrow("item_path_conflict");
    } finally {
      db.close();
    }
  });

  it("retries safely when an old writer edits between selection and update", async () => {
    const {db, client} = await fixture();
    const query = client.queryD1.bind(client);
    let raced = false;
    client.queryD1 = async (config, sql, options) => {
      if (!raced && sql.startsWith("UPDATE items")) {
        raced = true;
        db.exec("UPDATE items SET data = '{\"title\":\"New 日本語\"}' WHERE id = 'migration01'");
      }
      return query(config, sql, options);
    };
    await prepareItemUrls(client, config);
    await prepareItemUrls(client, config);
    expect(db.prepare("SELECT public_path FROM items").get()).toEqual({public_path: legacyItemPath({id: "migration01", title: "New 日本語"})});
    db.exec("UPDATE items SET data = '{\"title\":\"Old writer later\"}' WHERE id = 'migration01'");
    await prepareItemUrls(client, config);
    expect(db.prepare("SELECT count(*) AS count FROM item_paths").get()).toEqual({count: 2});
    db.close();
  });

  it("resumes an interrupted backfill and picks up writes made after the first pass", async () => {
    const {db, client} = await fixture();
    const query = client.queryD1.bind(client);
    let fail = true;
    client.queryD1 = async (config, sql, options) => {
      const rows = await query(config, sql, options);
      if (sql.startsWith("UPDATE") && fail) { fail = false; throw new Error("Interrupted"); }
      return rows;
    };
    await expect(prepareItemUrls(client, config)).rejects.toThrow("Interrupted");
    db.exec("INSERT INTO items(id,status,data) VALUES ('migration02',1,'{\"title\":\"Late old writer\"}')");
    await prepareItemUrls(client, config);
    expect(db.prepare("SELECT count(*) AS count FROM items WHERE public_path IS NULL").get()).toEqual({count: 0});
    expect(db.prepare("SELECT count(*) AS count FROM item_paths").get()).toEqual({count: 4});
    db.close();
  });

  it("retains renamed and deleted path reservations through data restoration", async () => {
    const {db, client} = await fixture();
    await prepareItemUrls(client, config);
    db.exec("UPDATE items SET public_path='/i/renamed/', url_mode='custom' WHERE id='migration01'");
    db.exec("DELETE FROM items WHERE id='migration01'");
    expect(SNAPSHOT_TABLES.durable).toContain("item_paths");
    const history = db.prepare("SELECT * FROM item_paths ORDER BY path").all();
    db.exec("DELETE FROM item_paths");
    for (const row of history) db.prepare("INSERT INTO item_paths VALUES(?,?,?)").run(row.path!, row.item_id!, row.was_public!);
    db.exec("INSERT INTO items(id,status,data) VALUES('migration03',1,'{}')");
    expect(() => db.exec("UPDATE items SET public_path='/i/renamed/' WHERE id='migration03'"))
      .toThrow("item_path_conflict");
    expect(() => db.exec("INSERT INTO items(id,status,data,public_path) VALUES('migration04',1,'{}','/i/renamed/')"))
      .toThrow("item_path_conflict");
    expect(db.prepare("SELECT * FROM item_paths WHERE item_id='migration01' ORDER BY path").all()).toEqual(history);
    db.close();
  });

  it("normalizes combining and supplementary Unicode characters without transliteration", () => {
    expect(normalizeItemSlug("CAFÉ")).toBe("café");
    expect(normalizeItemSlug("Cafe\u0301")).toBe("café");
    expect(normalizeItemSlug("𠀀中文-日本語-한국어-ภาษาไทย")).toBe("𠀀中文-日本語-한국어-ภาษาไทย");
    expect(normalizeItemSlug("𠀀".repeat(120))).toHaveLength(240);
    expect(() => normalizeItemSlug("𠀀".repeat(121))).toThrow();
  });

  it("restores exact snapshot rows before enabling reservation triggers", async () => {
    const {db, client} = await fixture();
    await prepareItemUrls(client, config);
    db.exec("UPDATE items SET public_path='/i/renamed/',url_mode='custom' WHERE id='migration01'");
    db.exec("INSERT INTO items(id,status,data) VALUES('deleted0001',1,'{}')");
    db.exec("DELETE FROM items WHERE id='deleted0001'");
    const schema = db.prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END").all();
    const quote = (value: unknown) => value === null ? "NULL" : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
    const data = ["items", "item_paths"].flatMap((table) => db.prepare(`SELECT * FROM ${table}`).all().map((row) =>
      `INSERT INTO ${table} (${Object.keys(row).join(",")}) VALUES (${Object.values(row).map(quote).join(",")});`));
    const restored = new DatabaseSync(":memory:");
    restored.exec(buildRestoreSql({currentApplicationTables: [], snapshotApplicationTables: [], schemaSql: schema.map(({sql}) => `${sql};`).join("\n"), dataSql: data.join("\n")}));
    expect(restored.prepare("SELECT * FROM item_paths ORDER BY path").all()).toEqual(db.prepare("SELECT * FROM item_paths ORDER BY path").all());
    restored.exec("INSERT INTO items(id,status,data) VALUES('different01',1,'{}')");
    expect(() => restored.exec("UPDATE items SET public_path='/i/deleted0001/' WHERE id='different01'"))
      .toThrow("item_path_conflict");
    restored.close(); db.close();
  });
});
