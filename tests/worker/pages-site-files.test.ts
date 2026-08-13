import {env} from "cloudflare:workers";
import type {APIContext, APIRoute} from "astro";
import {beforeEach, describe, expect, it} from "vitest";

import FeedDb from "@/server/feed/FeedDb";
import {updateApiAccessSettings} from "@/server/api/api-keys";
import {
  createPage,
  deletePage,
  getPageById,
  listPages,
  navigationPages,
  PageConflictError,
  PageRequestError,
  PageThemeUnsupportedError,
  reorderPageNavigation,
  resolvePagePath,
  updatePage,
} from "@/server/pages/service";
import {loadPublicPageRoute} from "@/server/pages/public";
import {searchContent} from "@/server/items/search";
import {
  createSiteFile,
  getSiteFileById,
  publishSiteFile,
  resetSiteFile,
  SiteFileRequestError,
  updateSiteFile,
} from "@/server/site-files/service";
import {publicSiteFileResponse} from "@/server/site-files/public";
import {renderSiteFileForRequest} from "@/server/site-files/templates";
import ThemeStore from "@/server/themes/ThemeStore";
import {GET as searchJson} from "@/pages/search.json";
import {
  createApiPage,
  createApiSiteFile,
  deleteApiPage,
  deleteApiSiteFile,
  getApiPage,
  getApiSiteFile,
  listApiPages,
  listApiSiteFiles,
  previewApiSiteFile,
  publishApiSiteFile,
  resetApiSiteFile,
  updateApiPage,
  updateApiSiteFile,
  validateApiPage,
  validateApiSiteFile,
} from "@/server/api/handlers";
import {DEFAULT_NOT_FOUND_PAGE_ID} from "@/shared/Pages";
import {STATUSES} from "@/shared/Constants";
import {SITE_FILE_TEMPLATE_COLLECTION_LIMIT} from "@/shared/SiteFiles";
import type {
  ThemeBundleV1,
  ThemeManifestV1,
} from "@/shared/themes/ThemeContract";

const ORIGIN = "https://feed.example.com";

function v2Theme(): {bundle: ThemeBundleV1; manifest: ThemeManifestV1} {
  return {
    bundle: {
      assets: [],
      rssStylesheet: '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"></xsl:stylesheet>',
      webBodyEnd: "",
      webBodyStart: "",
      webFeed: "<main>{{title}}</main>",
      webHeader: "",
      webItem: "<main>{{items.0.title}}</main>",
      webPage:
        "<main>{{page.title}}{{#page.is_not_found_page}} (404){{/page.is_not_found_page}}</main>",
      webSearch: "<main>Search</main>",
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
        webPage: "page.mustache",
        webSearch: "search.mustache",
      },
      formatVersion: 2,
      license: "MIT",
      microfeed: "*",
      name: "Test v2",
      packageId: "tests.pages-v2",
      version: "1.0.0",
    },
  };
}

async function database(pathname = "/"): Promise<FeedDb> {
  const request = new Request(`${ORIGIN}${pathname}`);
  const db = new FeedDb(env, request);
  await db.getContent();
  return db;
}

async function activateV2(): Promise<void> {
  const store = new ThemeStore(env.FEED_DB);
  const theme = v2Theme();
  const installed = await store.installVersion({
    ...theme,
    id: "tests-pages-v2",
    source: {kind: "admin"},
  });
  await store.activate(installed.id);
}

async function activateV1(): Promise<void> {
  const store = new ThemeStore(env.FEED_DB);
  const source = v2Theme();
  const {webPage: _webPage, webSearch: _webSearch, ...bundle} = source.bundle;
  const files = {
    rssStylesheet: source.manifest.files.rssStylesheet,
    webBodyEnd: source.manifest.files.webBodyEnd,
    webBodyStart: source.manifest.files.webBodyStart,
    webFeed: source.manifest.files.webFeed,
    webHeader: source.manifest.files.webHeader,
    webItem: source.manifest.files.webItem,
  };
  const installed = await store.installVersion({
    bundle,
    id: "tests-pages-v1",
    manifest: {
      ...source.manifest,
      files,
      formatVersion: 1,
      name: "Test v1",
      packageId: "tests.pages-v1",
    },
    source: {kind: "admin"},
  });
  await store.activate(installed.id);
}

async function apiContext(
  handler: APIRoute,
  database: FeedDb,
  request: Request,
  params: Record<string, string> = {},
): Promise<Response> {
  return await handler({
    locals: {feedDb: database},
    params,
    request,
    url: new URL(request.url),
  } as unknown as APIContext);
}

function jsonRequest(pathname: string, method: string, body: unknown): Request {
  return new Request(`${ORIGIN}${pathname}`, {
    body: JSON.stringify(body),
    headers: {"content-type": "application/json"},
    method,
  });
}

beforeEach(async () => {
  await env.FEED_DB.batch([
    env.FEED_DB.prepare(
      "DELETE FROM page_paths WHERE slug != '404' COLLATE NOCASE",
    ),
    env.FEED_DB.prepare(
      "DELETE FROM pages WHERE slug != '404' COLLATE NOCASE",
    ),
    env.FEED_DB.prepare(
      "UPDATE pages SET title = 'Page not found', " +
        "content_html = '<p>The page you requested could not be found.</p>', " +
        "content_text = 'The page you requested could not be found.', " +
        "status = 1, meta_description = NULL, show_in_navigation = 0, " +
        "navigation_label = 'Page not found', navigation_order = 0 " +
        "WHERE slug = '404' COLLATE NOCASE",
    ),
    env.FEED_DB.prepare("DELETE FROM site_files WHERE generator IS NULL"),
    env.FEED_DB.prepare(
      "UPDATE site_files SET mode = 'generated', draft_content = '', " +
        "published_content = NULL, published_rendered_content = NULL, " +
        "enabled = 1 WHERE generator IS NOT NULL",
    ),
    env.FEED_DB.prepare(
      "UPDATE site_search_metadata SET ready = 1 WHERE id = 1",
    ),
    env.FEED_DB.prepare(
      "UPDATE theme_state SET active_theme_id = NULL, previous_theme_id = NULL",
    ),
    env.FEED_DB.prepare(
      "DELETE FROM themes WHERE id IN ('tests-pages-v1', 'tests-pages-v2')",
    ),
    env.FEED_DB.prepare(
      "DELETE FROM settings WHERE category = 'apiSettings'",
    ),
  ]);
});

describe("public Pages", () => {
  it("renders and protects the editable default 404 Page", async () => {
    await activateV2();
    const request = new Request(`${ORIGIN}/404/`);
    const db = await database("/404/");
    const page = await getPageById(
      env.FEED_DB,
      request,
      DEFAULT_NOT_FOUND_PAGE_ID,
    );
    expect(page).toMatchObject({
      id: DEFAULT_NOT_FOUND_PAGE_ID,
      is_not_found_page: true,
      show_in_navigation: false,
      slug: "404",
      status: "published",
    });
    await expect(createPage(db, request, {
      slug: "404",
      title: "Another 404",
    })).rejects.toBeInstanceOf(PageRequestError);

    const preview = await loadPublicPageRoute(env, request, "404");
    expect(preview).toMatchObject({
      kind: "page",
      layout: {
        bodyHtml: "<main>Page not found (404)</main>",
        canonicalUrl: `${ORIGIN}/404/`,
      },
      status: 404,
    });
    const missing = await loadPublicPageRoute(
      env,
      new Request(`${ORIGIN}/missing/path/`),
      "missing/path",
    );
    expect(missing).toMatchObject({
      kind: "page",
      layout: {bodyHtml: "<main>Page not found (404)</main>"},
      status: 404,
    });
    if (missing.kind !== "page") throw new Error("Expected the 404 Page.");
    expect(missing.layout.canonicalUrl).toBeUndefined();

    const updated = await updatePage(db, request, page!.id, {
      content_html: "<p>A friendlier missing page.</p>",
      show_in_navigation: false,
      slug: "404",
      status: "published",
      title: "Nothing here",
    });
    expect(updated).toMatchObject({
      content_text: "A friendlier missing page.",
      is_not_found_page: true,
      title: "Nothing here",
    });
    await expect(updatePage(db, request, page!.id, {slug: "lost"}))
      .rejects.toBeInstanceOf(PageRequestError);
    await expect(updatePage(db, request, page!.id, {
      show_in_navigation: true,
    })).rejects.toBeInstanceOf(PageRequestError);
    await expect(deletePage(db, page!.id))
      .rejects.toBeInstanceOf(PageRequestError);
    expect(await navigationPages(env.FEED_DB, request)).toEqual([]);

    const search = await searchContent(env.FEED_DB, request, {
      fields: ["title", "content"],
      limit: 10,
      query: "friendlier missing",
      statuses: ["published"],
      types: ["page"],
    });
    expect(search.items).toEqual([]);
    expect(await (await publicSiteFileResponse(
      env,
      new Request(`${ORIGIN}/llms.txt`),
      "llms.txt",
    )).text()).not.toContain(`${ORIGIN}/404/`);
    expect(await (await publicSiteFileResponse(
      env,
      new Request(`${ORIGIN}/sitemap.xml`),
      "sitemap.xml",
    )).text()).not.toContain(`${ORIGIN}/404/`);
  });

  it("keeps v1 installations compatible and requires v2 only for publication", async () => {
    await activateV1();
    const request = new Request(`${ORIGIN}/about/`);
    const db = await database("/about/");
    await expect(createPage(db, request, {
      show_in_navigation: false,
      status: "unpublished",
      title: "Missing path",
    })).rejects.toThrow("Enter a URL path, such as about.");
    await expect(createPage(db, request, {
      slug: "missing-label",
      status: "unpublished",
      title: "Missing label",
    })).rejects.toThrow(
      "Enter a navigation label, or turn off Show in navigation.",
    );
    await expect(createPage(db, request, {
      navigation_label: "About",
      slug: "about",
      status: "published",
      title: "About",
    })).rejects.toBeInstanceOf(PageThemeUnsupportedError);

    const draft = await createPage(db, request, {
      content_html: "<p>Draft body</p>",
      navigation_label: "About",
      slug: "about",
      status: "unpublished",
      title: "About",
    });
    expect(draft.slug).toBe("about");

    await activateV2();
    const published = await updatePage(db, request, draft.id, {
      navigation_label: "About us",
      slug: "about-us",
      status: "published",
    });
    expect(published).toMatchObject({slug: "about-us", status: "published"});
    const publicPage = await loadPublicPageRoute(env, request, "about-us");
    expect(publicPage).toMatchObject({
      kind: "page",
      layout: {
        bodyHtml: "<main>About</main>",
        canonicalUrl: `${ORIGIN}/about-us/`,
        title: "About",
      },
    });
    expect(await resolvePagePath(env.FEED_DB, request, "about"))
      .toMatchObject({redirect: true, page: {id: draft.id, slug: "about-us"}});
    expect(await navigationPages(env.FEED_DB, request)).toEqual([
      expect.objectContaining({id: draft.id, navigation_label: "About us"}),
    ]);

    const search = await searchContent(env.FEED_DB, request, {
      fields: ["title", "content"],
      limit: 10,
      query: "draft body",
      statuses: ["published"],
      types: ["page"],
    });
    expect(search.items).toEqual([
      expect.objectContaining({id: draft.id, slug: "about-us", type: "page"}),
    ]);
    expect(await deletePage(db, draft.id)).toBe(true);
    expect(await resolvePagePath(env.FEED_DB, request, "about-us")).toBeNull();
  });

  it("serves dates and highlighted excerpts to the public search interface", async () => {
    await activateV2();
    const request = new Request(`${ORIGIN}/search-result-page/`);
    const db = await database("/search-result-page/");
    const page = await createPage(db, request, {
      content_html: "<p>An introduction with a searchable needle inside.</p>",
      navigation_label: "Search result",
      slug: "search-result-page",
      status: "published",
      title: "Public search result",
    });

    const response = await apiContext(
      searchJson,
      db,
      new Request(`${ORIGIN}/search.json?q=needle`),
    );
    expect(response.status).toBe(200);
    const data = await response.json() as {
      items: Array<{
        date_published?: string;
        highlights?: {content_text?: Array<{matched: boolean}>};
        id: string;
      }>;
    };
    const result = data.items.find(({id}) => id === page.id);
    expect(result?.date_published).toEqual(expect.any(String));
    expect(result?.highlights?.content_text?.some(({matched}) => matched))
      .toBe(true);
  });

  it("keeps Unlisted Pages public only at their direct URL", async () => {
    await activateV2();
    const request = new Request(`${ORIGIN}/private-link/`);
    const db = await database("/private-link/");
    const unlisted = await createPage(db, request, {
      content_html: "<p>Shared by direct link</p>",
      show_in_navigation: true,
      slug: "private-link",
      status: "unlisted",
      title: "Private link",
    });

    expect(unlisted).toMatchObject({
      show_in_navigation: false,
      status: "unlisted",
    });
    expect(await resolvePagePath(env.FEED_DB, request, "private-link"))
      .toMatchObject({page: {id: unlisted.id}, redirect: false});
    expect(await navigationPages(env.FEED_DB, request)).toEqual([]);
    expect((await searchContent(env.FEED_DB, request, {
      fields: ["title", "content"],
      limit: 10,
      query: "shared direct link",
      statuses: ["published"],
      types: ["page"],
    })).items).toEqual([]);

    const published = await updatePage(db, request, unlisted.id, {
      status: "published",
    });
    expect(published).toMatchObject({show_in_navigation: false});
    const shown = await updatePage(db, request, unlisted.id, {
      navigation_label: "Private link",
      show_in_navigation: true,
    });
    expect(shown).toMatchObject({show_in_navigation: true});
    const hiddenAgain = await updatePage(db, request, unlisted.id, {
      show_in_navigation: true,
      status: "unlisted",
    });
    expect(hiddenAgain).toMatchObject({
      show_in_navigation: false,
      status: "unlisted",
    });
    expect(await navigationPages(env.FEED_DB, request)).toEqual([]);
  });

  it("orders website navigation in one validated batch", async () => {
    await activateV2();
    const request = new Request(`${ORIGIN}/pages/`);
    const db = await database("/pages/");
    const about = await createPage(db, request, {
      navigation_label: "About",
      slug: "about",
      status: "published",
      title: "About",
    });
    const contact = await createPage(db, request, {
      navigation_label: "Contact",
      slug: "contact",
      status: "published",
      title: "Contact",
    });
    const press = await createPage(db, request, {
      show_in_navigation: false,
      slug: "press",
      status: "published",
      title: "Press",
    });

    const enabledPress = await updatePage(db, request, press.id, {
      navigation_label: "Press",
      show_in_navigation: true,
    });
    expect(enabledPress!.navigation_order).toBeGreaterThan(
      contact.navigation_order,
    );

    await reorderPageNavigation(db, [press.id, contact.id, about.id]);
    expect((await navigationPages(env.FEED_DB, request)).map(({id}) => id))
      .toEqual([press.id, contact.id, about.id]);
    await expect(reorderPageNavigation(db, [about.id]))
      .rejects.toBeInstanceOf(PageConflictError);
  });
});

describe("editable Site Files", () => {
  it("identifies microfeed and advertises only an available API guide", async () => {
    const request = new Request(`${ORIGIN}/llms.txt`);
    const render = async () => (await publicSiteFileResponse(
      env,
      request,
      "llms.txt",
    )).text();

    const disabledContent = await render();
    expect(disabledContent).toContain(
      "[microfeed](https://github.com/microfeed/microfeed), an agentic CMS on Cloudflare",
    );
    expect(disabledContent).toContain("<https://docs.microfeed.org/>");
    expect(disabledContent).not.toContain(`${ORIGIN}/api/llms-full.txt`);

    await updateApiAccessSettings(env.FEED_DB, {
      enabled: true,
      publicDocsEnabled: false,
    });
    expect(await render()).not.toContain(`${ORIGIN}/api/llms-full.txt`);

    await updateApiAccessSettings(env.FEED_DB, {
      enabled: true,
      publicDocsEnabled: true,
    });
    expect(await render()).toContain(
      `<${ORIGIN}/api/llms-full.txt>`,
    );
  });

  it("limits every template to 100 Published items and ordinary Pages", async () => {
    const request = new Request(`${ORIGIN}/limits.txt`);
    const timestamps = Array.from(
      {length: SITE_FILE_TEMPLATE_COLLECTION_LIMIT + 1},
      (_, index) => new Date(Date.UTC(2099, 0, 1, 0, index)).toISOString(),
    );
    await env.FEED_DB.batch([
      env.FEED_DB.prepare(
        "DELETE FROM items WHERE id LIKE 'site-limit-item-%'",
      ),
      env.FEED_DB.prepare(
        "DELETE FROM pages WHERE id LIKE 'site-limit-page-%'",
      ),
      env.FEED_DB.prepare(
        "UPDATE pages SET status = ?, updated_at = ? WHERE id = ?",
      ).bind(
        STATUSES.PUBLISHED,
        "2100-01-01T00:00:00.000Z",
        DEFAULT_NOT_FOUND_PAGE_ID,
      ),
    ]);
    await env.FEED_DB.batch(timestamps.map((timestamp, index) =>
      env.FEED_DB.prepare(`
        INSERT INTO items (
          id, status, data, pub_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        `site-limit-item-${index}`,
        STATUSES.PUBLISHED,
        JSON.stringify({title: `Limit item ${index}`}),
        timestamp,
        timestamp,
        timestamp,
      )
    ));
    await env.FEED_DB.batch(timestamps.map((timestamp, index) =>
      env.FEED_DB.prepare(`
        INSERT INTO pages (
          id, slug, title, status, navigation_label,
          published_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `site-limit-page-${index}`,
        `limit-page-${index}`,
        `Limit Page ${index}`,
        STATUSES.PUBLISHED,
        `Limit Page ${index}`,
        timestamp,
        timestamp,
        timestamp,
      )
    ));
    await env.FEED_DB.batch([
      env.FEED_DB.prepare(`
        INSERT INTO items (
          id, status, data, pub_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        "site-limit-item-unpublished",
        STATUSES.UNPUBLISHED,
        JSON.stringify({title: "Unpublished limit item"}),
        "2200-01-01T00:00:00.000Z",
        "2200-01-01T00:00:00.000Z",
        "2200-01-01T00:00:00.000Z",
      ),
      env.FEED_DB.prepare(`
        INSERT INTO pages (
          id, slug, title, status, navigation_label,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        "site-limit-page-unpublished",
        "limit-page-unpublished",
        "Unpublished limit Page",
        STATUSES.UNPUBLISHED,
        "Unpublished limit Page",
        "2200-01-01T00:00:00.000Z",
        "2200-01-01T00:00:00.000Z",
      ),
    ]);

    const db = await database("/limits.txt");
    try {
      const template =
        "{{#items}}{{id}}:{{_loop.index}}:{{_loop.first}}:{{_loop.last}}\n{{/items}}" +
        "{{#pages}}{{slug}}:{{_loop.index}}:{{_loop.first}}:{{_loop.last}}\n{{/pages}}";
      const custom = await renderSiteFileForRequest(db, request, {
        contentType: "text/plain",
        filename: "limits.txt",
        template,
      });
      const sitemap = await renderSiteFileForRequest(db, request, {
        contentType: "text/plain",
        filename: "sitemap.xml",
        generator: "sitemap",
        template,
      });
      const items = custom.context.items as Array<{
        _loop: {first: boolean; index: number; last: boolean};
        id: string;
      }>;
      const pages = custom.context.pages as Array<{
        _loop: {first: boolean; index: number; last: boolean};
        id: string;
        slug: string;
      }>;

      expect(items).toHaveLength(SITE_FILE_TEMPLATE_COLLECTION_LIMIT);
      expect(items[0]).toMatchObject({
        _loop: {first: true, index: 1, last: false},
        id: `site-limit-item-${SITE_FILE_TEMPLATE_COLLECTION_LIMIT}`,
      });
      expect(items.at(-1)).toMatchObject({
        _loop: {
          first: false,
          index: SITE_FILE_TEMPLATE_COLLECTION_LIMIT,
          last: true,
        },
        id: "site-limit-item-1",
      });
      expect(items.map(({id}) => id)).not.toContain(
        "site-limit-item-unpublished",
      );
      expect(pages).toHaveLength(SITE_FILE_TEMPLATE_COLLECTION_LIMIT);
      expect(pages[0]).toMatchObject({
        _loop: {first: true, index: 1, last: false},
        slug: `limit-page-${SITE_FILE_TEMPLATE_COLLECTION_LIMIT}`,
      });
      expect(pages.at(-1)).toMatchObject({
        _loop: {
          first: false,
          index: SITE_FILE_TEMPLATE_COLLECTION_LIMIT,
          last: true,
        },
        slug: "limit-page-1",
      });
      expect(pages.map(({id}) => id)).not.toContain(
        DEFAULT_NOT_FOUND_PAGE_ID,
      );
      expect(pages.map(({id}) => id)).not.toContain(
        "site-limit-page-unpublished",
      );
      expect(sitemap.context.items).toHaveLength(
        SITE_FILE_TEMPLATE_COLLECTION_LIMIT,
      );
      expect(sitemap.context.pages).toHaveLength(
        SITE_FILE_TEMPLATE_COLLECTION_LIMIT,
      );

      const listedPages = await listPages(db, request, {
        excludeNotFoundPage: true,
        limit: SITE_FILE_TEMPLATE_COLLECTION_LIMIT,
        statuses: ["published"],
      });
      expect(listedPages.items).toHaveLength(
        SITE_FILE_TEMPLATE_COLLECTION_LIMIT,
      );

      const generatedSitemap = await publicSiteFileResponse(
        env,
        new Request(`${ORIGIN}/sitemap.xml`),
        "sitemap.xml",
      );
      const generatedContent = await generatedSitemap.text();
      expect(generatedContent).toContain("limit-page-100");
      expect(generatedContent).not.toContain("limit-page-0");
      expect(generatedContent).toContain("site-limit-item-100");
      expect(generatedContent).not.toContain("site-limit-item-0");

      await updateSiteFile(db, request, "system-sitemap", {
        draft_content:
          "<urls>{{#items}}<item>{{id}}</item>{{/items}}" +
          "{{#pages}}<page>{{slug}}</page>{{/pages}}</urls>",
      });
      await publishSiteFile(db, request, "system-sitemap");
      const overriddenContent = await (await publicSiteFileResponse(
        env,
        new Request(`${ORIGIN}/sitemap.xml`),
        "sitemap.xml",
      )).text();
      expect(overriddenContent).toContain("site-limit-item-100");
      expect(overriddenContent).not.toContain("site-limit-item-0");
      expect(overriddenContent).toContain("limit-page-100");
      expect(overriddenContent).not.toContain("limit-page-0");
    } finally {
      await env.FEED_DB.batch([
        env.FEED_DB.prepare(
          "DELETE FROM items WHERE id LIKE 'site-limit-item-%'",
        ),
        env.FEED_DB.prepare(
          "DELETE FROM pages WHERE id LIKE 'site-limit-page-%'",
        ),
        env.FEED_DB.prepare(
          "UPDATE site_files SET mode = 'generated', draft_content = '', " +
            "published_content = NULL, published_rendered_content = NULL " +
            "WHERE id = 'system-sitemap'",
        ),
      ]);
    }
  });

  it("serves generated defaults, published overrides, reset, and custom files", async () => {
    const request = new Request(`${ORIGIN}/robots.txt`);
    const generated = await publicSiteFileResponse(env, request, "robots.txt");
    expect(generated.status).toBe(200);
    expect(await generated.text()).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);

    const db = await database("/robots.txt");
    const robots = await getSiteFileById(env.FEED_DB, request, "system-robots");
    expect(robots?.mode).toBe("generated");
    expect(robots?.draft_content).toContain("{{{_site.sitemap_url}}}");
    await updateSiteFile(db, request, "system-robots", {
      draft_content: "User-agent: *\nDisallow: /private/\n",
    });
    await publishSiteFile(db, request, "system-robots");
    expect(await (await publicSiteFileResponse(env, request, "robots.txt")).text())
      .toContain("Disallow: /private/");
    await resetSiteFile(db, request, "system-robots");
    expect(await (await publicSiteFileResponse(env, request, "robots.txt")).text())
      .toContain("Allow: /");

    const custom = await createSiteFile(db, request, {
      content_type: "text/plain",
      draft_content: "contact: mailto:security@example.com\n",
      enabled: true,
      filename: "security.txt",
    });
    expect((await publicSiteFileResponse(env, request, custom.filename)).status)
      .toBe(404);
    await publishSiteFile(db, request, custom.id);
    const response = await publicSiteFileResponse(env, request, custom.filename);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toContain("security@example.com");
  });

  it("renders live Mustache data and falls back to the publish snapshot", async () => {
    const request = new Request(`${ORIGIN}/site.json`);
    const db = await database("/site.json");
    const original = await db.getContent();
    const custom = await createSiteFile(db, request, {
      content_type: "application/json",
      draft_content: '{"title":"{{{title}}}","home":"{{home_page_url}}"}',
      enabled: true,
      filename: "site.json",
    });
    await publishSiteFile(db, request, custom.id);
    const published = JSON.parse(
      await (await publicSiteFileResponse(env, request, custom.filename)).text(),
    ) as {title: string};

    try {
      await db.putContent({
        channel: {...original.channel, title: "Updated live title"},
      });
      expect(JSON.parse(
        await (await publicSiteFileResponse(env, request, custom.filename)).text(),
      )).toMatchObject({title: "Updated live title"});

      await db.putContent({
        channel: {...original.channel, title: 'Invalid " JSON title'},
      });
      expect(JSON.parse(
        await (await publicSiteFileResponse(env, request, custom.filename)).text(),
      )).toMatchObject({title: published.title});
    } finally {
      await db.putContent({channel: original.channel});
    }
  });

  it("validates Mustache source and the rendered output before publishing", async () => {
    const request = new Request(`${ORIGIN}/broken.json`);
    const db = await database("/broken.json");
    await expect(createSiteFile(db, request, {
      draft_content: "{{#title}}broken",
      enabled: true,
      filename: "broken.txt",
    })).rejects.toBeInstanceOf(SiteFileRequestError);

    const custom = await createSiteFile(db, request, {
      content_type: "application/json",
      draft_content: '{"title": {{{title}}}}',
      enabled: true,
      filename: "broken.json",
    });
    await expect(publishSiteFile(db, request, custom.id))
      .rejects.toBeInstanceOf(SiteFileRequestError);
  });
});

describe("Pages and Site Files API handlers", () => {
  it("validates and runs the complete Page CRUD contract", async () => {
    await activateV2();
    const db = await database("/api/v1/pages/");
    const missingSlug = await validateApiPage({
      request: jsonRequest("/api/v1/pages/validate/", "POST", {
        navigation_label: "API About",
        title: "API About",
      }),
    } as APIContext);
    expect(await missingSlug.json()).toEqual({
      error: "Enter a URL path, such as about.",
    });
    const missingNavigationLabel = await validateApiPage({
      request: jsonRequest("/api/v1/pages/validate/", "POST", {
        slug: "api-about",
        title: "API About",
      }),
    } as APIContext);
    expect(await missingNavigationLabel.json()).toEqual({
      error: "Enter a navigation label, or turn off Show in navigation.",
    });
    const validation = await validateApiPage({
      request: jsonRequest("/api/v1/pages/validate/", "POST", {
        navigation_label: "API About",
        slug: "api-about",
        title: "API About",
      }),
    } as APIContext);
    expect(validation.status).toBe(200);
    const unlistedValidation = await validateApiPage({
      request: jsonRequest("/api/v1/pages/validate/", "POST", {
        show_in_navigation: true,
        slug: "api-unlisted",
        status: "unlisted",
        title: "API Unlisted",
      }),
    } as APIContext);
    expect(unlistedValidation.status).toBe(200);

    const created = await apiContext(
      createApiPage,
      db,
      jsonRequest("/api/v1/pages/", "POST", {
        content_html: "<p>Created through the API</p>",
        navigation_label: "API About",
        slug: "api-about",
        status: "published",
        title: "API About",
      }),
    );
    expect(created.status).toBe(201);
    const {id} = await created.json() as {id: string};

    expect((await apiContext(
      getApiPage,
      db,
      new Request(`${ORIGIN}/api/v1/pages/${id}/`),
      {pageId: id},
    )).status).toBe(200);
    const listed = await apiContext(
      listApiPages,
      db,
      new Request(`${ORIGIN}/api/v1/pages/?status=published`),
    );
    expect((await listed.json() as {items: Array<{id: string}>}).items)
      .toEqual(expect.arrayContaining([expect.objectContaining({id})]));

    const unlistedCreated = await apiContext(
      createApiPage,
      db,
      jsonRequest("/api/v1/pages/", "POST", {
        show_in_navigation: true,
        slug: "api-unlisted",
        status: "unlisted",
        title: "API Unlisted",
      }),
    );
    expect(unlistedCreated.status).toBe(201);
    const {id: unlistedId} = await unlistedCreated.json() as {id: string};
    expect(await (await apiContext(
      getApiPage,
      db,
      new Request(`${ORIGIN}/api/v1/pages/${unlistedId}/`),
      {pageId: unlistedId},
    )).json()).toMatchObject({
      id: unlistedId,
      show_in_navigation: false,
      status: "unlisted",
    });

    const updated = await apiContext(
      updateApiPage,
      db,
      jsonRequest(`/api/v1/pages/${id}/`, "PUT", {title: "Updated API About"}),
      {pageId: id},
    );
    expect(await updated.json()).toMatchObject({id, title: "Updated API About"});
    expect((await apiContext(
      deleteApiPage,
      db,
      new Request(`${ORIGIN}/api/v1/pages/${id}/`, {method: "DELETE"}),
      {pageId: id},
    )).status).toBe(200);
    expect((await apiContext(
      deleteApiPage,
      db,
      new Request(
        `${ORIGIN}/api/v1/pages/${DEFAULT_NOT_FOUND_PAGE_ID}/`,
        {method: "DELETE"},
      ),
      {pageId: DEFAULT_NOT_FOUND_PAGE_ID},
    )).status).toBe(400);
    expect((await apiContext(
      deleteApiPage,
      db,
      new Request(`${ORIGIN}/api/v1/pages/${unlistedId}/`, {method: "DELETE"}),
      {pageId: unlistedId},
    )).status).toBe(200);
  });

  it("validates and runs Site File draft, publish, reset, and delete contracts", async () => {
    const db = await database("/api/v1/site-files/");
    const validation = await apiContext(
      validateApiSiteFile,
      db,
      jsonRequest("/api/v1/site-files/validate/", "POST", {
        draft_content: "Contact: security@example.com\n",
        filename: "security.txt",
      }),
    );
    expect(validation.status).toBe(200);

    const created = await apiContext(
      createApiSiteFile,
      db,
      jsonRequest("/api/v1/site-files/", "POST", {
        draft_content: "Contact: security@example.com\n",
        enabled: true,
        filename: "security.txt",
      }),
    );
    expect(created.status).toBe(201);
    const {id} = await created.json() as {id: string};
    const preview = await apiContext(
      previewApiSiteFile,
      db,
      jsonRequest("/api/v1/site-files/preview/", "POST", {
        draft_content: "# {{title}}\n{{#items}}- {{title}}\n{{/items}}",
        filename: "security.txt",
        site_file_id: id,
      }),
    );
    expect(preview.headers.get("cache-control")).toBe("private, no-store");
    expect(await preview.json()).toMatchObject({
      content_type: "text/plain",
      valid: true,
    });
    const jsonPreview = await apiContext(
      previewApiSiteFile,
      db,
      jsonRequest("/api/v1/site-files/preview/", "POST", {
        content_type: "application/json",
        draft_content: "{{{_site.json_feed}}}",
        filename: "feed.json",
      }),
    );
    const jsonPreviewBody = await jsonPreview.json() as {
      rendered_content: string;
    };
    expect(JSON.parse(jsonPreviewBody.rendered_content)).toHaveProperty("items");
    expect((await apiContext(
      getApiSiteFile,
      db,
      new Request(`${ORIGIN}/api/v1/site-files/${id}/`),
      {siteFileId: id},
    )).status).toBe(200);
    expect((await apiContext(
      listApiSiteFiles,
      db,
      new Request(`${ORIGIN}/api/v1/site-files/`),
    ).then((response) => response.json()) as {items: Array<{id: string}>}).items)
      .toContainEqual(expect.objectContaining({id}));

    const updated = await apiContext(
      updateApiSiteFile,
      db,
      jsonRequest(`/api/v1/site-files/${id}/`, "PUT", {
        draft_content: "Contact: updated@example.com\n",
      }),
      {siteFileId: id},
    );
    expect(await updated.json()).toMatchObject({id});
    expect((await apiContext(
      publishApiSiteFile,
      db,
      new Request(`${ORIGIN}/api/v1/site-files/${id}/publish/`, {method: "POST"}),
      {siteFileId: id},
    ).then((response) => response.json()))).toMatchObject({mode: "override"});

    await updateSiteFile(db, new Request(`${ORIGIN}/robots.txt`), "system-robots", {
      draft_content: "User-agent: *\nDisallow: /private/\n",
    });
    await apiContext(
      publishApiSiteFile,
      db,
      new Request(`${ORIGIN}/api/v1/site-files/system-robots/publish/`, {method: "POST"}),
      {siteFileId: "system-robots"},
    );
    expect((await apiContext(
      resetApiSiteFile,
      db,
      new Request(`${ORIGIN}/api/v1/site-files/system-robots/reset/`, {method: "POST"}),
      {siteFileId: "system-robots"},
    ).then((response) => response.json()))).toMatchObject({mode: "generated"});

    expect((await apiContext(
      deleteApiSiteFile,
      db,
      new Request(`${ORIGIN}/api/v1/site-files/${id}/`, {method: "DELETE"}),
      {siteFileId: id},
    )).status).toBe(200);
  });
});
