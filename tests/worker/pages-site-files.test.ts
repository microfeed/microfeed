import {env} from "cloudflare:workers";
import type {APIContext, APIRoute} from "astro";
import {beforeEach, describe, expect, it} from "vitest";

import FeedDb from "@/server/feed/FeedDb";
import {
  createPage,
  deletePage,
  getPageById,
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
import ThemeStore from "@/server/themes/ThemeStore";
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
      "DELETE FROM themes WHERE id = 'tests-pages-v2'",
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
