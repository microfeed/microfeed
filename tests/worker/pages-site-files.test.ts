import {env} from "cloudflare:workers";
import type {APIContext, APIRoute} from "astro";
import {beforeEach, describe, expect, it} from "vitest";

import FeedDb from "@/server/feed/FeedDb";
import {
  createPage,
  deletePage,
  navigationPages,
  PageThemeUnsupportedError,
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
  publishApiSiteFile,
  resetApiSiteFile,
  updateApiPage,
  updateApiSiteFile,
  validateApiPage,
  validateApiSiteFile,
} from "@/server/api/handlers";
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
      webPage: "<main>{{page.title}}</main>",
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
    env.FEED_DB.prepare("DELETE FROM pages"),
    env.FEED_DB.prepare("DELETE FROM page_paths"),
    env.FEED_DB.prepare("DELETE FROM site_files WHERE generator IS NULL"),
    env.FEED_DB.prepare(
      "UPDATE site_files SET mode = 'generated', draft_content = '', " +
        "published_content = NULL, enabled = 1 WHERE generator IS NOT NULL",
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
  it("keeps v1 installations compatible and requires v2 only for publication", async () => {
    const request = new Request(`${ORIGIN}/about/`);
    const db = await database("/about/");
    await expect(createPage(db, request, {
      status: "published",
      title: "About",
    })).rejects.toBeInstanceOf(PageThemeUnsupportedError);

    const draft = await createPage(db, request, {
      content_html: "<p>Draft body</p>",
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
});

describe("Pages and Site Files API handlers", () => {
  it("validates and runs the complete Page CRUD contract", async () => {
    await activateV2();
    const db = await database("/api/v1/pages/");
    const validation = await validateApiPage({
      request: jsonRequest("/api/v1/pages/validate/", "POST", {
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
      .toEqual([expect.objectContaining({id})]);

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
  });

  it("validates and runs Site File draft, publish, reset, and delete contracts", async () => {
    const db = await database("/api/v1/site-files/");
    const validation = await validateApiSiteFile({
      request: jsonRequest("/api/v1/site-files/validate/", "POST", {
        draft_content: "Contact: security@example.com\n",
        filename: "security.txt",
      }),
    } as APIContext);
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
