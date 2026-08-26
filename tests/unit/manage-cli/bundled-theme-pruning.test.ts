import {afterEach, describe, expect, it, vi} from "vitest";
import {Miniflare} from "miniflare";

import {pruneSupersededBundledThemeVersions} from "../../../manage-cli/lib/bundled-theme-pruning";

const miniflares: Miniflare[] = [];

const emptyBundle = JSON.stringify({
  assets: [],
  rssStylesheet: "rss",
  webBodyEnd: "end",
  webBodyStart: "start",
  webFeed: "feed",
  webHeader: "header",
  webItem: "item",
});

async function database(): Promise<D1Database> {
  const miniflare = new Miniflare({
    d1Databases: {DATABASE: "bundled-theme-pruning"},
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
  });
  miniflares.push(miniflare);
  const database = await miniflare.getD1Database("DATABASE");
  await database.exec([
    "CREATE TABLE themes (id TEXT PRIMARY KEY, package_id TEXT NOT NULL, version TEXT NOT NULL, source_kind TEXT NOT NULL, bundle_json TEXT NOT NULL, origin_theme_id TEXT, asset_owner_theme_id TEXT, deleted_at TIMESTAMP, assets_deleted_at TIMESTAMP, asset_cleanup_error TEXT);",
    "CREATE TABLE theme_drafts (id TEXT PRIMARY KEY, origin_theme_id TEXT, asset_owner_theme_id TEXT);",
    "CREATE TABLE theme_state (id TEXT PRIMARY KEY, active_theme_id TEXT, previous_theme_id TEXT);",
    "INSERT INTO theme_state (id, active_theme_id, previous_theme_id) VALUES ('current', NULL, NULL);",
  ].join("\n"));
  return database;
}

async function insertTheme(
  database: D1Database,
  input: {
    assetOwnerThemeId?: string | null;
    bundle?: string;
    id: string;
    originThemeId?: string | null;
    packageId?: string;
    sourceKind?: string;
    version: string;
  },
): Promise<void> {
  await database.prepare(
    `INSERT INTO themes (
      id, package_id, version, source_kind, bundle_json,
      origin_theme_id, asset_owner_theme_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    input.id,
    input.packageId ?? "microfeed.default",
    input.version,
    input.sourceKind ?? "bundled",
    input.bundle ?? emptyBundle,
    input.originThemeId ?? null,
    input.assetOwnerThemeId ?? null,
  ).run();
}

function pruningStore(database: D1Database, deleteAssets = vi.fn()) {
  return {
    deleteAssets,
    query: async (
      sql: string,
      parameters: Array<string | number | null> = [],
    ) => {
      const result = await database.prepare(sql).bind(...parameters)
        .all<Record<string, unknown>>();
      return result.results;
    },
  };
}

afterEach(async () => {
  await Promise.all(miniflares.splice(0).map((miniflare) =>
    miniflare.dispose()
  ));
});

describe("superseded bundled theme pruning", () => {
  it("keeps active, rollback, referenced, current, newer, and untrusted versions", async () => {
    const db = await database();
    await Promise.all([
      insertTheme(db, {id: "safe-old", version: "1.0.0"}),
      insertTheme(db, {id: "active-old", version: "1.0.1"}),
      insertTheme(db, {id: "previous-old", version: "1.0.2"}),
      insertTheme(db, {id: "draft-origin-old", version: "1.0.3"}),
      insertTheme(db, {id: "draft-owner-old", version: "1.0.4"}),
      insertTheme(db, {id: "dependent-origin-old", version: "1.0.5"}),
      insertTheme(db, {id: "dependent-owner-old", version: "1.0.6"}),
      insertTheme(db, {id: "invalid-version", version: "legacy"}),
      insertTheme(db, {id: "current", version: "1.1.10"}),
      insertTheme(db, {id: "newer", version: "1.1.11"}),
      insertTheme(db, {
        id: "user-theme",
        sourceKind: "github",
        version: "0.9.0",
      }),
      insertTheme(db, {
        id: "origin-dependent",
        originThemeId: "dependent-origin-old",
        packageId: "org.example.origin",
        sourceKind: "github",
        version: "1.0.0",
      }),
      insertTheme(db, {
        assetOwnerThemeId: "dependent-owner-old",
        id: "asset-dependent",
        packageId: "org.example.asset",
        sourceKind: "github",
        version: "1.0.0",
      }),
    ]);
    await db.prepare(
      `UPDATE theme_state SET active_theme_id = ?, previous_theme_id = ?
       WHERE id = 'current'`,
    ).bind("active-old", "previous-old").run();
    await db.batch([
      db.prepare(
        "INSERT INTO theme_drafts (id, origin_theme_id) VALUES (?, ?)",
      ).bind("origin-draft", "draft-origin-old"),
      db.prepare(
        "INSERT INTO theme_drafts (id, asset_owner_theme_id) VALUES (?, ?)",
      ).bind("asset-draft", "draft-owner-old"),
    ]);

    const first = await pruneSupersededBundledThemeVersions(
      pruningStore(db),
      "microfeed.default",
      "1.1.10",
    );
    expect(first).toEqual(["safe-old"]);

    await db.prepare(
      `UPDATE theme_state SET active_theme_id = NULL, previous_theme_id = NULL
       WHERE id = 'current'`,
    ).run();
    await db.prepare("DELETE FROM theme_drafts").run();
    await db.prepare(
      `UPDATE themes SET deleted_at = CURRENT_TIMESTAMP
       WHERE id IN ('origin-dependent', 'asset-dependent')`,
    ).run();
    const second = await pruneSupersededBundledThemeVersions(
      pruningStore(db),
      "microfeed.default",
      "1.1.10",
    );
    expect(second).toEqual([
      "active-old",
      "previous-old",
      "draft-origin-old",
      "draft-owner-old",
      "dependent-origin-old",
      "dependent-owner-old",
    ]);

    const remaining = await db.prepare(
      "SELECT id FROM themes WHERE deleted_at IS NULL ORDER BY id",
    ).all<{id: string}>();
    expect(remaining.results.map(({id}) => id)).toEqual([
      "current",
      "invalid-version",
      "newer",
      "user-theme",
    ]);
  });

  it("deletes unreferenced assets after preserving the version tombstone", async () => {
    const db = await database();
    const ownerId = "asset-owner";
    const bundle = JSON.stringify({
      ...JSON.parse(emptyBundle),
      assets: [{
        contentType: "text/css",
        key: "themes/asset-owner/theme.css",
        path: "theme.css",
        sha256: "a".repeat(64),
        size: 12,
      }],
    });
    await insertTheme(db, {
      assetOwnerThemeId: ownerId,
      bundle,
      id: ownerId,
      version: "1.0.0",
    });
    await insertTheme(db, {id: "current", version: "1.1.10"});
    const deleteAssets = vi.fn(async () => undefined);

    await expect(pruneSupersededBundledThemeVersions(
      pruningStore(db, deleteAssets),
      "microfeed.default",
      "1.1.10",
    )).resolves.toEqual([ownerId]);
    expect(deleteAssets).toHaveBeenCalledWith([
      "themes/asset-owner/theme.css",
    ]);
    const owner = await db.prepare(
      `SELECT deleted_at, assets_deleted_at, asset_cleanup_error
       FROM themes WHERE id = ?`,
    ).bind(ownerId).first<{
      asset_cleanup_error: string | null;
      assets_deleted_at: string | null;
      deleted_at: string | null;
    }>();
    expect(owner?.deleted_at).not.toBeNull();
    expect(owner?.assets_deleted_at).not.toBeNull();
    expect(owner?.asset_cleanup_error).toBeNull();
  });
});
