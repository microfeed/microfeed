import {env} from "cloudflare:workers";
import {beforeEach, describe, expect, it, vi} from "vitest";

import FeedDb from "@/server/feed/FeedDb";
import {loadPublishedFeed} from "@/server/feed/feed";
import ThemeStore from "@/server/themes/ThemeStore";
import {themePreviewResponse} from "@/server/themes/ThemePreview";
import {POST as manageTheme} from "@/pages/.well-known/microfeed/theme-management/index";
import {sha256Hex} from "@/shared/themes/ThemeRenderer";
import type {
  ThemeBundleV1,
  ThemeManifestV1,
} from "@/shared/themes/ThemeContract";
import {
  THEME_MAX_DRAFTS,
  THEME_MAX_INSTALLED_VERSIONS,
} from "@/shared/themes/ThemeContract";

function packageData(packageId: string, version = "1.0.0"):
  {bundle: ThemeBundleV1; manifest: ThemeManifestV1} {
  return {
    bundle: {
      assets: [],
      rssStylesheet: "<xsl:stylesheet xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\" version=\"1.0\"></xsl:stylesheet>",
      webBodyEnd: "",
      webBodyStart: "",
      webFeed: "<main>{{title}}</main>",
      webHeader: "",
      webItem: "<main>{{items.0.title}}</main>",
    },
    manifest: {
      assets: [],
      author: "Tests",
      files: {
        rssStylesheet: "rss.xsl",
        webBodyEnd: "body-end.mustache",
        webBodyStart: "body-start.mustache",
        webFeed: "feed.mustache",
        webHeader: "header.mustache",
        webItem: "item.mustache",
      },
      formatVersion: 1,
      license: "MIT",
      microfeed: "*",
      name: packageId,
      packageId,
      version,
    },
  };
}

describe("versioned theme storage", () => {
  beforeEach(async () => {
    await env.FEED_DB.batch([
      env.FEED_DB.prepare("DELETE FROM theme_management_tokens"),
      env.FEED_DB.prepare("DELETE FROM theme_drafts"),
      env.FEED_DB.prepare("DELETE FROM themes"),
      env.FEED_DB.prepare(
        `UPDATE theme_state SET active_theme_id = NULL,
         previous_theme_id = NULL, legacy_theme_id = NULL,
         legacy_migrated_at = NULL, legacy_migration_error = NULL,
         classic_theme_id = NULL, appearance_preserved_at = NULL,
         appearance_preservation_error = NULL
         WHERE id = 'current'`,
      ),
      env.FEED_DB.prepare(
        "UPDATE settings SET data = '{}' WHERE category = 'customCode'",
      ),
    ]);
  });

  it("migrates the selected legacy theme once without changing rollback data", async () => {
    const database = new FeedDb(env, new Request("https://example.test/"));
    await database.getContent();
    const legacy = packageData("legacy.source").bundle;
    const customCode = {
      currentTheme: "custom",
      themes: {custom: legacy},
      webHeader: "shared header retained separately",
    };
    const serialized = JSON.stringify(customCode);
    await env.FEED_DB.prepare(
      "UPDATE settings SET data = ? WHERE category = 'customCode'",
    ).bind(serialized).run();

    const loaded = await loadPublishedFeed(
      env,
      new Request("https://example.test/"),
      {includeActiveTheme: true},
    );
    expect(loaded.content.activeTheme).toMatchObject({
      bundle: {webFeed: legacy.webFeed},
      id: "legacy-theme-v1",
      name: "Imported site theme",
      packageId: "local.legacy-theme",
      sourceKind: "migration",
      version: "1.0.0",
    });
    expect(loaded.content.themeMigrationCompleted).toBe(true);
    const retained = await env.FEED_DB.prepare(
      "SELECT data FROM settings WHERE category = 'customCode'",
    ).first<{data: string}>();
    expect(retained?.data).toBe(serialized);
    const state = await env.FEED_DB.prepare(
      `SELECT active_theme_id, legacy_theme_id, legacy_migrated_at
       FROM theme_state WHERE id = 'current'`,
    ).first<Record<string, unknown>>();
    expect(state).toMatchObject({
      active_theme_id: "legacy-theme-v1",
      legacy_theme_id: "legacy-theme-v1",
    });
    expect(state?.legacy_migrated_at).toBeTruthy();

    await loadPublishedFeed(
      env,
      new Request("https://example.test/"),
      {includeActiveTheme: true},
    );
    const count = await env.FEED_DB.prepare(
      "SELECT count(*) AS count FROM themes WHERE source_kind = 'migration'",
    ).first<{count: number}>();
    expect(count?.count).toBe(1);
    const store = new ThemeStore(env.FEED_DB);
    await store.deactivate();
    await store.deleteVersion("legacy-theme-v1", env.MEDIA_BUCKET);
  });

  it("installs classic to preserve an upgraded site with no selected version", async () => {
    const database = new FeedDb(env, new Request("https://example.test/"));
    await database.getContent();
    const loaded = await loadPublishedFeed(
      env,
      new Request("https://example.test/"),
      {includeActiveTheme: true},
    );
    expect(loaded.content.activeTheme).toMatchObject({
      id: "bundled-classic-v1",
      packageId: "microfeed.classic",
      sourceKind: "bundled",
      version: "1.0.0",
    });
    expect(loaded.content.themeMigrationCompleted).toBe(true);
  });

  it("imports legacy theme data without replacing an existing active version", async () => {
    const database = new FeedDb(env, new Request("https://example.test/"));
    await database.getContent();
    const store = new ThemeStore(env.FEED_DB);
    const activeSource = packageData(`worker.active.${crypto.randomUUID()}`);
    const active = await store.installVersion({
      ...activeSource,
      source: {kind: "local-directory"},
    });
    await store.activate(active.id);
    const legacy = packageData("legacy.source").bundle;
    const customCode = {
      currentTheme: "custom",
      themes: {custom: legacy},
    };
    const serialized = JSON.stringify(customCode);
    await env.FEED_DB.prepare(
      "UPDATE settings SET data = ? WHERE category = 'customCode'",
    ).bind(serialized).run();

    const loaded = await loadPublishedFeed(
      env,
      new Request("https://example.test/"),
      {includeActiveTheme: true},
    );
    expect(loaded.content.activeTheme?.id).toBe(active.id);
    expect((await store.getState()).activeThemeId).toBe(active.id);
    expect(await store.getVersion("legacy-theme-v1")).toMatchObject({
      name: "Imported site theme",
      packageId: "local.legacy-theme",
      sourceKind: "migration",
      version: "1.0.0",
    });
    const retained = await env.FEED_DB.prepare(
      "SELECT data FROM settings WHERE category = 'customCode'",
    ).first<{data: string}>();
    expect(retained?.data).toBe(serialized);

    await store.deactivate();
    await store.deleteVersion(active.id, env.MEDIA_BUCKET);
    await store.deleteVersion("legacy-theme-v1", env.MEDIA_BUCKET);
  });

  it("installs idempotently, publishes inactive drafts, and changes state explicitly", async () => {
    const purge = vi.fn().mockResolvedValue({errors: [], success: true});
    const store = new ThemeStore(env.FEED_DB, {purge});
    const source = packageData(`worker.flow.${crypto.randomUUID()}`);
    const installed = await store.installVersion({
      ...source,
      source: {kind: "local-directory", path: "/theme"},
    });
    const repeated = await store.installVersion({
      ...source,
      source: {kind: "local-directory", path: "/theme"},
    });
    expect(repeated.id).toBe(installed.id);
    await expect(store.installVersion({
      bundle: {...source.bundle, webFeed: "changed"},
      manifest: source.manifest,
      source: {kind: "local-directory"},
    })).rejects.toThrow("different content");

    const draft = await store.createDraft({
      ...source,
      originKind: "theme",
      originThemeId: installed.id,
    });
    expect(draft.packageId).toBe(`local.${source.manifest.packageId}`);
    expect(draft.version).toBe("1.0.1");
    const saved = await store.saveDraft(draft.id, {
      bundle: {...draft.bundle, webFeed: "<main>custom {{title}}</main>"},
      manifest: {...draft.manifest, version: "1.1.0"},
    });
    expect((await store.listDrafts()).some(({id}) => id === draft.id)).toBe(true);
    const published = await store.publishDraft(saved.id);
    expect((await store.getState()).activeThemeId).toBeNull();
    expect(await store.getDraft(saved.id)).toBeNull();
    const collisionDraft = await store.createDraft({
      assetOwnerThemeId: published.assetOwnerThemeId,
      bundle: published.bundle,
      manifest: published.manifest,
      originKind: "theme",
      originThemeId: published.id,
    });
    const collision = await store.saveDraft(collisionDraft.id, {
      bundle: collisionDraft.bundle,
      manifest: {
        ...collisionDraft.manifest,
        version: published.version,
      },
    });
    await expect(store.publishDraft(collision.id)).rejects.toThrow(
      "already exists",
    );
    await store.discardDraft(collision.id);

    await store.activate(installed.id);
    expect((await store.getState()).activeThemeId).toBe(installed.id);
    await store.activate(installed.id);
    expect((await store.getState()).previousThemeId).toBeNull();
    await store.activate(published.id);
    expect(await store.getState()).toMatchObject({
      activeThemeId: published.id,
      previousThemeId: installed.id,
    });
    await store.rollback();
    expect(await store.getState()).toMatchObject({
      activeThemeId: installed.id,
      previousThemeId: published.id,
    });
    await expect(store.deleteVersion(installed.id, env.MEDIA_BUCKET)).rejects.toThrow("active theme");
    await store.deactivate();
    expect((await store.getState()).activeThemeId).toBeNull();
    expect(purge).toHaveBeenCalledTimes(4);
  });

  it("lists searchable, sorted metadata without serializing theme bundles", async () => {
    const store = new ThemeStore(env.FEED_DB);
    const first = packageData(`worker.alpha.${crypto.randomUUID()}`);
    first.manifest.name = "Alpha Editorial";
    first.manifest.author = "Ada";
    const second = packageData(`worker.beta.${crypto.randomUUID()}`);
    second.manifest.name = "Beta Journal";
    second.manifest.author = "Bea";
    const installed = await Promise.all([
      store.installVersion({...first, source: {kind: "github", url: "https://github.com/example/alpha"}}),
      store.installVersion({...second, source: {kind: "local-directory", path: "/beta"}}),
    ]);
    const derivedPackage = packageData(`worker.derived.${crypto.randomUUID()}`);
    derivedPackage.manifest.name = "Derived Alpha";
    await store.installVersion({
      ...derivedPackage,
      originThemeId: installed[0]!.id,
      source: {kind: "admin"},
    });
    await store.activate(installed[1]!.id);
    const searched = await store.listSummaries({page: 1, q: "ADA", sort: "name-desc"});
    expect(searched.pagination).toMatchObject({page: 1, pageSize: 20, total: 1, totalPages: 1});
    expect(searched.limits).toEqual({drafts: 20, installed: 50});
    expect(searched.themes[0]).toMatchObject({name: "Alpha Editorial", assetCount: 0});
    expect(searched.themes[0]).not.toHaveProperty("bundle");
    expect(searched.drafts).toEqual([]);
    const derivedSummary = await store.listSummaries({
      page: 1,
      q: "Derived Alpha",
      sort: "status",
    });
    expect(derivedSummary.themes[0]).toMatchObject({
      originThemeId: installed[0]!.id,
      originThemeName: "Alpha Editorial",
      originThemeVersion: installed[0]!.version,
    });
    const byStatus = await store.listSummaries({page: 1, q: "", sort: "status"});
    expect(byStatus.themes[0]?.id).toBe(installed[1]!.id);
  });

  it("enforces installed and draft limits while retaining a blocked publication", async () => {
    const store = new ThemeStore(env.FEED_DB);
    const source = packageData(`worker.limit.base.${crypto.randomUUID()}`);
    const base = await store.installVersion({...source, source: {kind: "local-directory"}});
    const draft = await store.createDraft({
      ...source,
      originKind: "theme",
      originThemeId: base.id,
    });
    const manifestJson = JSON.stringify(source.manifest);
    const bundleJson = JSON.stringify(source.bundle);
    await env.FEED_DB.batch(Array.from(
      {length: THEME_MAX_INSTALLED_VERSIONS - 1},
      (_, index) => env.FEED_DB.prepare(
        `INSERT INTO themes (
          id, package_id, version, name, manifest_json, bundle_json,
          source_kind, checksum_sha256
        ) VALUES (?, ?, '1.0.0', ?, ?, ?, 'migration', ?)`,
      ).bind(
        `limit-${index}`,
        `worker.limit.${index}`,
        `Limit ${index}`,
        manifestJson,
        bundleJson,
        String(index).padStart(64, "0").slice(-64),
      ),
    ));
    await expect(store.installVersion({
      ...packageData(`worker.limit.extra.${crypto.randomUUID()}`),
      source: {kind: "local-directory"},
    })).rejects.toThrow(`${THEME_MAX_INSTALLED_VERSIONS} installed theme versions`);
    await expect(store.installVersion({...source, source: {kind: "local-directory"}}))
      .resolves.toMatchObject({id: base.id});
    await expect(store.publishDraft(draft.id)).rejects.toThrow("draft has been retained");
    await expect(store.getDraft(draft.id)).resolves.toMatchObject({id: draft.id});
    await store.deleteVersion("limit-0", env.MEDIA_BUCKET);
    await expect(store.publishDraft(draft.id)).resolves.toMatchObject({packageId: draft.packageId});
    expect(await store.getDraft(draft.id)).toBeNull();

    await env.FEED_DB.prepare("DELETE FROM theme_drafts").run();
    await env.FEED_DB.batch(Array.from(
      {length: THEME_MAX_DRAFTS},
      (_, index) => env.FEED_DB.prepare(
        `INSERT INTO theme_drafts (
          id, package_id, version, name, manifest_json, bundle_json, origin_kind
        ) VALUES (?, ?, '1.0.0', ?, ?, ?, 'theme')`,
      ).bind(
        `draft-limit-${index}`,
        `local.worker.draft-limit-${index}`,
        `Draft ${index}`,
        manifestJson,
        bundleJson,
      ),
    ));
    await expect(store.createDraft({...source, originKind: "theme"}))
      .rejects.toThrow(`${THEME_MAX_DRAFTS} theme drafts`);
  });

  it("loads the active row only when a rendered route requests it", async () => {
    const store = new ThemeStore(env.FEED_DB);
    const source = packageData(`worker.query.${crypto.randomUUID()}`);
    const theme = await store.installVersion({
      ...source,
      source: {kind: "local-directory"},
    });
    await store.activate(theme.id);
    const database = new FeedDb(env, new Request("https://example.test/"));
    expect((await database.getContent()).activeTheme).toBeUndefined();
    expect((await database.getContent(null, true)).activeTheme.id).toBe(theme.id);
    await store.deactivate();
  });

  it("reserves soft-deleted package versions", async () => {
    const store = new ThemeStore(env.FEED_DB);
    const source = packageData(`worker.deleted.${crypto.randomUUID()}`);
    const installed = await store.installVersion({
      ...source,
      source: {kind: "local-directory"},
    });
    await store.deleteVersion(installed.id, env.MEDIA_BUCKET);
    await expect(store.installVersion({
      ...source,
      source: {kind: "local-directory"},
    })).rejects.toThrow("was deleted");
  });

  it("serializes concurrent activation updates without losing rollback state", async () => {
    const store = new ThemeStore(env.FEED_DB);
    const firstSource = packageData(`worker.concurrent.a.${crypto.randomUUID()}`);
    const secondSource = packageData(`worker.concurrent.b.${crypto.randomUUID()}`);
    const [first, second] = await Promise.all([
      store.installVersion({...firstSource, source: {kind: "local-directory"}}),
      store.installVersion({...secondSource, source: {kind: "local-directory"}}),
    ]);
    await store.deactivate();
    await Promise.all([store.activate(first.id), store.activate(second.id)]);
    const state = await store.getState();
    expect([first.id, second.id]).toContain(state.activeThemeId);
    expect([first.id, second.id]).toContain(state.previousThemeId);
    expect(state.previousThemeId).not.toBe(state.activeThemeId);
    await store.deactivate();
  });

  it("retains inherited assets until no published version or draft references the owner", async () => {
    const store = new ThemeStore(env.FEED_DB);
    const ownerId = crypto.randomUUID();
    const key = `development/themes/${ownerId}/assets/logo.svg`;
    await env.MEDIA_BUCKET.put(key, "<svg/>", {httpMetadata: {contentType: "image/svg+xml"}});
    const source = packageData(`worker.assets.${crypto.randomUUID()}`);
    source.manifest.assets = ["assets/logo.svg"];
    source.bundle.assets = [{
      contentType: "image/svg+xml",
      key,
      path: "assets/logo.svg",
      sha256: "6".repeat(64),
      size: 6,
    }];
    const owner = await store.installVersion({
      ...source,
      assetOwnerThemeId: ownerId,
      id: ownerId,
      source: {kind: "local-directory"},
    });
    const heldDraft = await store.createDraft({
      ...source,
      assetOwnerThemeId: owner.id,
      originKind: "theme",
      originThemeId: owner.id,
    });
    await expect(store.saveDraft(heldDraft.id, {
      bundle: {...heldDraft.bundle, assets: []},
      manifest: {...heldDraft.manifest, assets: []},
    })).rejects.toThrow("six text slots");
    const publishDraft = await store.createDraft({
      ...source,
      assetOwnerThemeId: owner.id,
      originKind: "theme",
      originThemeId: owner.id,
    });
    const child = await store.publishDraft(publishDraft.id);
    await store.deleteVersion(owner.id, env.MEDIA_BUCKET);
    expect(await env.MEDIA_BUCKET.head(key)).not.toBeNull();
    await store.deleteVersion(child.id, env.MEDIA_BUCKET);
    expect(await env.MEDIA_BUCKET.head(key)).not.toBeNull();
    await store.discardDraft(heldDraft.id, env.MEDIA_BUCKET);
    expect(await env.MEDIA_BUCKET.head(key)).toBeNull();
  });

  it("logs and falls back when active state points to a missing version", async () => {
    const missingId = crypto.randomUUID();
    await env.FEED_DB.prepare(
      "UPDATE theme_state SET active_theme_id = ? WHERE id = 'current'",
    ).bind(missingId).run();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const database = new FeedDb(env, new Request("https://example.test/"));
    expect((await database.getContent(null, true)).activeTheme).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining(missingId));
    log.mockRestore();
    await new ThemeStore(env.FEED_DB).deactivate();
  });

  it("consumes one-time management grants and isolates preview responses", async () => {
    const store = new ThemeStore(env.FEED_DB);
    const source = packageData(`worker.management.${crypto.randomUUID()}`);
    source.bundle.webHeader = "<script>document.body.dataset.theme='ran'</script>";
    const theme = await store.installVersion({
      ...source,
      source: {kind: "local-directory"},
    });
    const token = crypto.randomUUID() + crypto.randomUUID();
    await env.FEED_DB.prepare(
      "INSERT INTO theme_management_tokens (token_hash, action, theme_id, expires_at_ms) VALUES (?, 'activate', ?, ?)",
    ).bind(await sha256Hex(token), theme.id, Date.now() + 60_000).run();
    const managementRequest = () => new Request(
      "https://example.test/.well-known/microfeed/theme-management/",
      {headers: {authorization: `Bearer ${token}`}, method: "POST"},
    );
    const activated = await manageTheme({request: managementRequest()} as never) as Response;
    expect(activated.status).toBe(200);
    expect((await store.getState()).activeThemeId).toBe(theme.id);
    const replay = await manageTheme({request: managementRequest()} as never) as Response;
    expect(replay.status).toBe(401);

    const preview = await themePreviewResponse(
      env,
      new Request("http://localhost:4321/admin/ajax/themes/id/preview?view=feed"),
      theme,
    );
    expect(preview.headers.get("cache-control")).toBe("private, no-store");
    expect(preview.headers.get("content-security-policy")).toContain("sandbox allow-scripts");
    expect(preview.headers.get("content-security-policy")).not.toContain("allow-same-origin");
    expect(preview.headers.get("content-security-policy")).toContain(
      "img-src http://localhost:4321 https: data: blob:",
    );
    expect(await preview.text()).toContain("document.body.dataset.theme='ran'");

    source.bundle.rssStylesheet = [
      '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">',
      '<xsl:template match="/"><html><body>RSS preview rendered</body></html></xsl:template>',
      "</xsl:stylesheet>",
    ].join("");
    const rssTheme = await store.installVersion({
      ...source,
      manifest: {...source.manifest, packageId: `${source.manifest.packageId}.rss`},
      source: {kind: "local-directory"},
    });
    const rssPreviewUrl = "http://localhost:4321/admin/ajax/themes/id/preview?view=rss";
    const rssPreview = await themePreviewResponse(
      env,
      new Request(rssPreviewUrl),
      rssTheme,
    );
    expect(rssPreview.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    const rssPreviewHtml = await rssPreview.text();
    expect(rssPreviewHtml).toContain("new XSLTProcessor()");
    expect(rssPreviewHtml).toContain(
      "http://localhost:4321/admin/ajax/themes/id/preview?view=rss-stylesheet",
    );
    expect(rssPreviewHtml).toContain("RSS preview rendered");
    const rssStylesheet = await themePreviewResponse(
      env,
      new Request(rssPreviewUrl.replace("view=rss", "view=rss-stylesheet")),
      rssTheme,
    );
    expect(rssStylesheet.headers.get("content-type")).toBe(
      "text/xsl; charset=utf-8",
    );
    expect(await rssStylesheet.text()).toContain("RSS preview rendered");
    await store.deactivate();
  });
});
