import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {DatabaseSync} from "node:sqlite";

import {describe, expect, it} from "vitest";

import {
  normalizeItemSearchContent,
  withItemSearchIndexesSuspended,
} from "../../manage-cli/lib/item-search";
import type {CloudflareClient} from "../../manage-cli/lib/cloudflare";
import type {MicrofeedConfig} from "../../manage-cli/types";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

async function migration(filename: string): Promise<string> {
  return readFile(path.join(repositoryRoot, "migrations", filename), "utf8");
}

function testCloudflare(database: DatabaseSync): CloudflareClient {
  return {
    async executeSqlFile(
      _config: MicrofeedConfig,
      filename: string,
    ): Promise<void> {
      database.exec(await readFile(filename, "utf8"));
    },
    async queryD1(
      _config: MicrofeedConfig,
      sql: string,
    ): Promise<Array<Record<string, unknown>>> {
      return database.prepare(sql).all() as Array<Record<string, unknown>>;
    },
  } as CloudflareClient;
}

const config = {} as MicrofeedConfig;

describe("item search migration and normalization", () => {
  it("backfills stored plain text and marks search ready", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec(await migration("0001_initial.sql"));
    database.prepare(
      "INSERT INTO items (id, status, data, updated_at) VALUES (?, 1, ?, ?)",
    ).run(
      "legacy-item",
      JSON.stringify({
        description: "<p>Hello&nbsp;<strong>world</strong></p>",
        title: "Legacy title",
      }),
      "2026-08-01T00:00:00.000Z",
    );
    database.exec(await migration("0009_item_search.sql"));
    database.exec(await migration("0013_pages_search_site_files.sql"));
    database.exec(await migration("0014_default_not_found_page.sql"));
    expect(database.prepare(
      "SELECT ready FROM site_search_metadata WHERE id = 1",
    ).get()).toEqual({ready: 0});

    expect(await normalizeItemSearchContent(
      testCloudflare(database),
      config,
    )).toBe(1);
    expect(database.prepare(
      "SELECT content_text, content_text_revision, " +
        "content_text_updated_at, updated_at FROM items",
    ).get()).toEqual({
      content_text: "Hello world",
      content_text_revision: 1,
      content_text_updated_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    });
    expect(database.prepare(
      "SELECT ready, normalized_at IS NOT NULL AS normalized " +
        "FROM site_search_metadata WHERE id = 1",
    ).get()).toEqual({normalized: 1, ready: 1});
    expect(database.prepare(
      "SELECT content_id FROM site_search_exact " +
        "WHERE site_search_exact MATCH 'world'",
    ).all()).toEqual([{content_id: "legacy-item"}]);
  });

  it("reconciles old-writer updates and outdated normalization revisions", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec(await migration("0001_initial.sql"));
    database.prepare(
      "INSERT INTO items (id, status, data, updated_at) VALUES (?, 1, ?, ?)",
    ).run(
      "racing-item",
      JSON.stringify({description: "<p>Before</p>", title: "Racing"}),
      "2026-08-01T00:00:00.000Z",
    );
    database.exec(await migration("0009_item_search.sql"));
    database.exec(await migration("0013_pages_search_site_files.sql"));
    database.exec(await migration("0014_default_not_found_page.sql"));
    const cloudflare = testCloudflare(database);
    await normalizeItemSearchContent(cloudflare, config);

    database.prepare(
      "UPDATE items SET data = ?, updated_at = ? WHERE id = ?",
    ).run(
      JSON.stringify({description: "<p>After switch</p>", title: "Racing"}),
      "2026-08-02T00:00:00.000Z",
      "racing-item",
    );
    expect(await normalizeItemSearchContent(cloudflare, config)).toBe(1);
    expect(database.prepare(
      "SELECT content_text FROM items WHERE id = 'racing-item'",
    ).get()).toEqual({content_text: "After switch"});

    database.prepare(
      "UPDATE items SET content_text = 'old algorithm', " +
        "content_text_revision = 0 WHERE id = 'racing-item'",
    ).run();
    expect(await normalizeItemSearchContent(cloudflare, config)).toBe(1);
    expect(database.prepare(
      "SELECT content_text, content_text_revision FROM items " +
        "WHERE id = 'racing-item'",
    ).get()).toEqual({content_text: "After switch", content_text_revision: 1});
  });

  it("temporarily removes virtual tables for export and rebuilds them", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec(await migration("0001_initial.sql"));
    database.exec(await migration("0009_item_search.sql"));
    database.exec(await migration("0013_pages_search_site_files.sql"));
    database.exec(await migration("0014_default_not_found_page.sql"));
    const cloudflare = testCloudflare(database);
    const result = await withItemSearchIndexesSuspended(
      cloudflare,
      config,
      async () => database.prepare(
        "SELECT COUNT(*) AS count FROM sqlite_schema " +
          "WHERE name LIKE 'site_search_%' AND type = 'table'",
      ).get() as {count: number},
    );
    expect(result).toEqual({count: 2});
    expect(database.prepare(
      "SELECT COUNT(*) AS count FROM sqlite_schema " +
        "WHERE name IN ('site_search_exact', 'site_search_title_trigram')",
    ).get()).toEqual({count: 2});
    expect(database.prepare(
      "SELECT ready FROM site_search_metadata WHERE id = 1",
    ).get()).toEqual({ready: 1});
  });

  it("creates an editable 404 Page outside the public search corpus", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec(await migration("0001_initial.sql"));
    database.exec(await migration("0009_item_search.sql"));
    database.exec(await migration("0013_pages_search_site_files.sql"));
    database.exec(await migration("0014_default_not_found_page.sql"));

    expect(database.prepare(
      "SELECT id, slug, title, status, show_in_navigation " +
        "FROM pages WHERE slug = '404'",
    ).get()).toEqual({
      id: "system-404",
      show_in_navigation: 0,
      slug: "404",
      status: 1,
      title: "Page not found",
    });
    expect(database.prepare(
      "SELECT content_id FROM site_search_exact " +
        "WHERE site_search_exact MATCH 'page not found'",
    ).all()).toEqual([]);

    database.prepare(
      "UPDATE pages SET title = 'Nothing here', " +
        "content_text = 'A friendlier missing page' WHERE slug = '404'",
    ).run();
    expect(database.prepare(
      "SELECT content_id FROM site_search_exact " +
        "WHERE site_search_exact MATCH 'friendlier'",
    ).all()).toEqual([]);
  });

  it("preserves an existing current /404/ Page during migration", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec(await migration("0001_initial.sql"));
    database.exec(await migration("0009_item_search.sql"));
    database.exec(await migration("0013_pages_search_site_files.sql"));
    database.prepare(
      "INSERT INTO pages (id, slug, title, status, show_in_navigation) " +
        "VALUES ('custom-404', '404', 'Custom missing', 2, 1)",
    ).run();
    database.prepare(
      "INSERT INTO page_paths (slug, page_id, is_current) " +
        "VALUES ('404', 'custom-404', 1)",
    ).run();

    database.exec(await migration("0014_default_not_found_page.sql"));

    expect(database.prepare(
      "SELECT id, title, status, show_in_navigation " +
        "FROM pages WHERE slug = '404'",
    ).get()).toEqual({
      id: "custom-404",
      show_in_navigation: 0,
      status: 1,
      title: "Custom missing",
    });
    expect(database.prepare(
      "SELECT COUNT(*) AS count FROM pages WHERE id = 'system-404'",
    ).get()).toEqual({count: 0});
  });
});
