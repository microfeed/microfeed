import {DatabaseSync} from "node:sqlite";
import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";
import {normalizeItemSearchContent, withItemSearchIndexesSuspended} from "../../manage-cli/lib/item-search";
import type {CloudflareClient} from "../../manage-cli/lib/cloudflare";
import type {MicrofeedConfig} from "../../manage-cli/types";
import {characterSearchTokens} from "@/shared/CharacterSearch";

async function fixture() {
  const db = new DatabaseSync(":memory:");
  for (const name of ["0001_initial", "0009_item_search", "0013_pages_search_site_files", "0014_default_not_found_page", "0023_multilingual_search"]) {
    db.exec(await readFile(new URL(`../../migrations/${name}.sql`, import.meta.url), "utf8"));
  }
  db.prepare("INSERT INTO items (id, status, data) VALUES ('legacy', 1, ?)").run(JSON.stringify({title: "学习中文", description: "<p>人工智能</p>"}));
  db.prepare("INSERT INTO pages (id, slug, title, content_text, status) VALUES ('page', 'page', '日本語ページ', '今日は東京です', 1)").run();
  const client = {
    async executeSqlFile(_config: MicrofeedConfig, filename: string) {
      const sql = await readFile(filename, "utf8");
      // Encoded projections cannot introduce SQL punctuation or oversized statements.
      for (const statement of sql.split(";")) expect(Buffer.byteLength(statement)).toBeLessThan(100_000);
      db.exec(sql);
    },
    async queryD1(_config: MicrofeedConfig, sql: string) {
      return db.prepare(sql).all();
    },
  } as CloudflareClient;
  const find = (text: string) => db.prepare("SELECT DISTINCT c.content_id FROM site_search_bigram JOIN site_search_character_chunks c ON c.id = site_search_bigram.rowid WHERE site_search_bigram MATCH ? ORDER BY c.content_id").all(`"${characterSearchTokens(text)}"`);
  return {db, client, find};
}

const config = {} as MicrofeedConfig;

describe("character search preparation", () => {
  it("backfills large HTML bodies without oversized SQL or text truncation", async () => {
    const {db, client, find} = await fixture();
    const text = "中文内容".repeat(12000) + "\u0000最后一句";
    db.prepare("UPDATE items SET data = json_set(data, '$.description', ?), content_text_revision = 0 WHERE id = 'legacy'")
      .run(`<p>${text}</p>`);
    await normalizeItemSearchContent(client, config);
    expect(db.prepare("SELECT content_text FROM items WHERE id = 'legacy'").get())
      .toEqual({content_text: text});
    expect(find("最后一句")).toEqual([{content_id: "legacy"}]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM site_search_character_state WHERE normalized_content_text != ''").get())
      .toEqual({count: 0});
    db.close();
  });

  it("backfills items and Pages and rebuilds after snapshot suspension", async () => {
    const {db, client, find} = await fixture();
    await normalizeItemSearchContent(client, config);
    expect(find("中文")).toEqual([{content_id: "legacy"}]);
    expect(find("東京")).toEqual([{content_id: "page"}]);
    await withItemSearchIndexesSuspended(client, config, async () => {
      expect(db.prepare("SELECT count(*) AS n FROM site_search_character_chunks").get()).toEqual({n: 0});
    });
    expect(find("中文")).toEqual([{content_id: "legacy"}]);
    expect(find("東京")).toEqual([{content_id: "page"}]);
    db.close();
  });

  it("rejects a stale backfill and reconciles an old writer even with an unchanged timestamp", async () => {
    const {db, client, find} = await fixture();
    const execute = client.executeSqlFile.bind(client);
    let raced = false;
    client.executeSqlFile = async (config, filename, options) => {
      const sql = await readFile(filename, "utf8");
      if (!raced && sql.includes("INSERT INTO site_search_character_chunks")) {
        raced = true;
        db.exec("UPDATE items SET data = json_set(data, '$.title', '新世界', '$.description', '<p>机器学习</p>') WHERE id = 'legacy'");
      }
      return execute(config, filename, options);
    };
    await normalizeItemSearchContent(client, config);
    expect(raced).toBe(true);
    expect(find("中文")).toEqual([]);
    expect(find("世界")).toEqual([{content_id: "legacy"}]);
    expect(find("人工智能")).toEqual([]);
    expect(find("机器学习")).toEqual([{content_id: "legacy"}]);
    expect(db.prepare("SELECT ready FROM site_search_metadata").get()).toEqual({ready: 1});
    db.close();
  });

  it("recovers after a partial projection failure without duplicating chunks", async () => {
    const {db, client, find} = await fixture();
    db.prepare("UPDATE pages SET content_text = ? WHERE id = 'page'").run("日本語".repeat(10000));
    const execute = client.executeSqlFile.bind(client);
    let failed = false;
    client.executeSqlFile = async (config, filename, options) => {
      const sql = await readFile(filename, "utf8");
      if (!failed && sql.includes("INSERT INTO site_search_character_chunks")) {
        failed = true;
        db.exec(sql.slice(0, sql.indexOf(";", sql.indexOf("INSERT INTO site_search_character_chunks")) + 1));
        throw new Error("Interrupted import");
      }
      return execute(config, filename, options);
    };
    await expect(normalizeItemSearchContent(client, config)).rejects.toThrow("Interrupted import");
    expect(db.prepare("SELECT ready FROM site_search_metadata").get()).toEqual({ready: 0});
    await normalizeItemSearchContent(client, config);
    expect(find("中文")).toEqual([{content_id: "legacy"}]);
    expect(find("日本語")).toEqual([{content_id: "page"}]);
    const count = db.prepare("SELECT count(*) AS n FROM site_search_character_chunks").get();
    await normalizeItemSearchContent(client, config);
    expect(db.prepare("SELECT count(*) AS n FROM site_search_character_chunks").get()).toEqual(count);
    db.close();
  });
});
