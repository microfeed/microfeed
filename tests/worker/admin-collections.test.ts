import {env} from "cloudflare:workers";
import type {APIContext, APIRoute} from "astro";
import {beforeEach, describe, expect, it} from "vitest";

import {GET as listAdminItems} from "@/pages/[adminPath]/ajax/items/index";
import {GET as getAdminItem} from "@/pages/[adminPath]/ajax/items/[itemId]";
import {GET as listAdminPages} from "@/pages/[adminPath]/ajax/pages/index";
import {GET as listAdminSiteFiles} from "@/pages/[adminPath]/ajax/site-files/index";
import FeedDb from "@/server/feed/FeedDb";
import {loadFeed} from "@/server/feed/feed";
import {STATUSES} from "@/shared/Constants";

const ORIGIN = "https://feed.example.com";
const NOW = "2026-08-14T20:00:00.000Z";

async function responseFrom(
  handler: APIRoute,
  pathname: string,
  params: Record<string, string> = {},
) {
  const request = new Request(`${ORIGIN}${pathname}`);
  const response = await handler({
    locals: {},
    params: {adminPath: "admin", ...params},
    request,
    url: new URL(request.url),
  } as unknown as APIContext);
  if (!(response instanceof Response)) throw new Error("Expected a response.");
  return response;
}

beforeEach(async () => {
  await new FeedDb(
    env,
    new Request(`${ORIGIN}/admin/`),
  ).getContent();
  await env.FEED_DB.batch([
    env.FEED_DB.prepare("DELETE FROM items WHERE id = ?").bind(
      "admin-summary-item",
    ),
    env.FEED_DB.prepare("DELETE FROM pages WHERE id = ?").bind(
      "admin-summary-page",
    ),
    env.FEED_DB.prepare("DELETE FROM site_files WHERE id = ?").bind(
      "admin-summary-file",
    ),
  ]);
  await env.FEED_DB.batch([
    env.FEED_DB.prepare(`
      INSERT INTO items (id, status, data, content_text, pub_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      "admin-summary-item",
      STATUSES.UNLISTED,
      JSON.stringify({
        contentHtml: "<p>This body must not be listed.</p>",
        description: "<p>Editable Item body.</p>",
        image: "images/summary.png",
        mediaFile: {category: "audio", durationSecond: 42, url: "audio/summary.mp3"},
        title: "Summary item",
      }),
      "This body must not be listed.",
      NOW,
      NOW,
      NOW,
    ),
    env.FEED_DB.prepare(`
      INSERT INTO pages (
        id, slug, title, content_html, content_text, status,
        meta_description, show_in_navigation, navigation_label,
        navigation_order, published_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      "admin-summary-page",
      "summary-page",
      "Summary Page",
      "<p>This Page body must not be listed.</p>",
      "This Page body must not be listed.",
      STATUSES.PUBLISHED,
      "Private list metadata",
      1,
      "Summary",
      20,
      NOW,
      NOW,
      NOW,
    ),
    env.FEED_DB.prepare(`
      INSERT INTO site_files (
        id, filename, mode, draft_content, content_type, enabled,
        created_at, updated_at
      ) VALUES (?, ?, 'override', ?, 'text/plain', 1, ?, ?)
    `).bind(
      "admin-summary-file",
      "summary.txt",
      "This Site File body must not be listed.",
      NOW,
      NOW,
    ),
  ]);
});

describe("admin collection endpoints", () => {
  it("omits items from the shared feed context used by list shells", async () => {
    const loaded = await loadFeed(
      env,
      new Request(`${ORIGIN}/admin/items/list/`),
      {includeItems: false},
    );

    expect(loaded.content.channel).toBeDefined();
    expect(loaded.content.settings).toBeDefined();
    expect(loaded.content.items).toBeUndefined();
  });

  it("returns only fields needed by the item list", async () => {
    const response = await responseFrom(
      listAdminItems,
      "/admin/ajax/items/?status=unlisted&sort=updated_at&order=desc&limit=20",
    );
    const body = await response.json() as Record<string, any>;
    const item = body.items.find(({id}: {id: string}) =>
      id === "admin-summary-item"
    );

    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toMatchObject({
      order: "desc",
      sort: "updated_at",
      statusFilter: "unlisted",
    });
    expect(item).toMatchObject({
      id: "admin-summary-item",
      image: "images/summary.png",
      mediaFile: {
        category: "audio",
        durationSecond: 42,
        url: "audio/summary.mp3",
      },
      title: "Summary item",
    });
    expect(item).not.toHaveProperty("contentHtml");
    expect(item).not.toHaveProperty("contentText");
  });

  it("returns one Item's editable WebMCP fields without caching", async () => {
    const response = await responseFrom(
      getAdminItem,
      "/admin/ajax/items/admin-summary-item/",
      {itemId: "admin-summary-item"},
    );
    await expect(response.json()).resolves.toEqual({
      content_html: "<p>Editable Item body.</p>",
      id: "admin-summary-item",
      status: STATUSES.UNLISTED,
      title: "Summary item",
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");

    const missing = await responseFrom(
      getAdminItem,
      "/admin/ajax/items/missing/",
      {itemId: "missing"},
    );
    expect(missing.status).toBe(404);
  });

  it("returns Page summaries and theme compatibility together", async () => {
    const response = await responseFrom(
      listAdminPages,
      "/admin/ajax/pages/",
    );
    const body = await response.json() as Record<string, any>;
    const page = body.items.find(({id}: {id: string}) =>
      id === "admin-summary-page"
    );

    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(typeof body.themeSupportsPages).toBe("boolean");
    expect(page).toMatchObject({
      id: "admin-summary-page",
      navigation_label: "Summary",
      show_in_navigation: true,
      slug: "summary-page",
      status: "published",
      title: "Summary Page",
    });
    expect(page).not.toHaveProperty("content_html");
    expect(page).not.toHaveProperty("content_text");
    expect(page).not.toHaveProperty("meta_description");
  });

  it("returns Site File metadata without template bodies", async () => {
    const response = await responseFrom(
      listAdminSiteFiles,
      "/admin/ajax/site-files/",
    );
    const body = await response.json() as Record<string, any>;
    const file = body.items.find(({id}: {id: string}) =>
      id === "admin-summary-file"
    );

    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(file).toEqual({
      content_type: "text/plain",
      enabled: true,
      filename: "summary.txt",
      id: "admin-summary-file",
    });
    expect(file).not.toHaveProperty("draft_content");
    expect(file).not.toHaveProperty("published_content");
  });
});
