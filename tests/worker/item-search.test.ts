import {env} from "cloudflare:workers";
import {beforeEach, describe, expect, it} from "vitest";
import type {APIContext} from "astro";

import {STATUSES} from "@/shared/Constants";
import FeedDb from "@/server/feed/FeedDb";
import {
  ItemSearchRequestError,
  searchItems,
} from "@/server/items/search";
import {searchApiItems} from "@/server/api/handlers";
import {apiSearchResponseSchema} from "@/shared/ApiSchemas";
import {getAdminItemSearch} from "@/pages/[adminPath]/ajax/search/index";

const ORIGIN = "https://feed.example.com";

async function database(): Promise<FeedDb> {
  const request = new Request(`${ORIGIN}/api/v1/search/`);
  const result = new FeedDb(env, request);
  await result.getContent();
  return result;
}

async function save(
  db: FeedDb,
  id: string,
  title: string,
  description: string,
  status = STATUSES.PUBLISHED,
  publishedAt = "2026-08-01T10:00:00.000Z",
): Promise<void> {
  await db.putContent({
    item: {
      description,
      id,
      pubDateMs: Date.parse(publishedAt),
      status,
      title,
    },
  });
}

beforeEach(async () => {
  await env.FEED_DB.prepare("DELETE FROM items WHERE id LIKE 'search-%'").run();
  await env.FEED_DB.prepare(
    "UPDATE item_search_metadata SET ready = 1 WHERE id = 1",
  ).run();
});

describe("D1 item search", () => {
  it("searches stored title/content text with AND, phrase, prefix, and highlights", async () => {
    const db = await database();
    await save(
      db,
      "search-alpha",
      "Alpha season finale",
      "<p>The launch &amp; finale recap.</p><script>ignore()</script>",
    );
    await save(db, "search-beta", "Beta season preview", "Other content");

    const row = await env.FEED_DB.prepare(
      "SELECT content_text, content_text_revision, " +
        "content_text_updated_at, updated_at FROM items " +
        "WHERE id = 'search-alpha'",
    ).first<{
      content_text: string;
      content_text_revision: number;
      content_text_updated_at: string;
      updated_at: string;
    }>();
    expect(row).toEqual({
      content_text: "The launch & finale recap.",
      content_text_revision: 1,
      content_text_updated_at: row?.updated_at,
      updated_at: row?.updated_at,
    });

    const phrase = await searchItems(env.FEED_DB, new Request(
      `${ORIGIN}/api/v1/search/?q=season`,
    ), {
      fields: ["title"],
      limit: 10,
      query: `'season finale'`,
      statuses: ["published", "unlisted", "unpublished"],
    });
    expect(phrase.items.map(({id}) => id)).toEqual(["search-alpha"]);
    expect(phrase.items[0]?.match_type).toBe("exact");
    expect(phrase.items[0]?.highlights.title.some(({matched}) => matched))
      .toBe(true);

    const prefix = await searchItems(env.FEED_DB, new Request(
      `${ORIGIN}/api/v1/search/?q=alpha+sea`,
    ), {
      fields: ["title"],
      limit: 10,
      query: "alpha sea",
      statuses: ["published"],
    });
    expect(prefix.items.map(({id}) => id)).toEqual(["search-alpha"]);

    const content = await searchItems(env.FEED_DB, new Request(
      `${ORIGIN}/api/v1/search/?q=launch+recap`,
    ), {
      fields: ["content"],
      limit: 10,
      query: "launch recap ",
      statuses: ["published"],
    });
    expect(content.items.map(({id}) => id)).toEqual(["search-alpha"]);
    expect(content.items[0]?.content_text).toBe("The launch & finale recap.");
  });

  it("falls back to title typos but keeps short terms and phrases exact", async () => {
    const db = await database();
    await save(db, "search-fuzzy", "A wonderful season finale", "Body");

    const fuzzy = await searchItems(env.FEED_DB, new Request(
      `${ORIGIN}/api/v1/search/?q=wondreful`,
    ), {
      fields: ["title"],
      limit: 5,
      query: "wondreful ",
      statuses: ["published"],
    });
    expect(fuzzy.items).toEqual([
      expect.objectContaining({id: "search-fuzzy", match_type: "fuzzy"}),
    ]);
    expect(fuzzy.items[0]?.highlights.title.some(({matched}) => matched))
      .toBe(true);

    const short = await searchItems(env.FEED_DB, new Request(
      `${ORIGIN}/api/v1/search/?q=wod`,
    ), {
      fields: ["title"],
      limit: 5,
      query: "wod ",
      statuses: ["published"],
    });
    expect(short.items).toEqual([]);

    const phrase = await searchItems(env.FEED_DB, new Request(
      `${ORIGIN}/api/v1/search/?q=finale`,
    ), {
      fields: ["title"],
      limit: 5,
      query: '"season finle"',
      statuses: ["published"],
    });
    expect(phrase.items).toEqual([]);
  });

  it("filters statuses and dates and rejects a cursor used with another query", async () => {
    const db = await database();
    await save(
      db,
      "search-old",
      "Common result old",
      "Body",
      STATUSES.UNLISTED,
      "2026-07-01T00:00:00.000Z",
    );
    await save(
      db,
      "search-new",
      "Common result new",
      "Body",
      STATUSES.PUBLISHED,
      "2026-08-01T00:00:00.000Z",
    );
    const first = await searchItems(env.FEED_DB, new Request(
      `${ORIGIN}/api/v1/search/?q=common`,
    ), {
      datePublishedMsGt: Date.parse("2026-07-15T00:00:00.000Z"),
      fields: ["title"],
      limit: 1,
      query: "common ",
      statuses: ["published"],
    });
    expect(first.items.map(({id}) => id)).toEqual(["search-new"]);
    expect(first.next_cursor).toBeDefined();
    await expect(searchItems(env.FEED_DB, new Request(
      `${ORIGIN}/api/v1/search/?q=different`,
    ), {
      fields: ["title"],
      limit: 1,
      nextCursor: first.next_cursor,
      query: "different",
      statuses: ["published"],
    })).rejects.toBeInstanceOf(ItemSearchRequestError);
  });

  it("keeps field and strict date filters and paginates exact before fuzzy", async () => {
    const db = await database();
    await save(
      db,
      "search-exact-a",
      "Cursor ranked alpha",
      "Body-only needle",
      STATUSES.PUBLISHED,
      "2026-08-01T00:00:00.000Z",
    );
    await save(
      db,
      "search-exact-b",
      "Cursor ranked beta",
      "Body",
      STATUSES.PUBLISHED,
      "2026-08-02T00:00:00.000Z",
    );
    await save(
      db,
      "search-fuzzy-page",
      "Cursor rankde gamma",
      "Body",
      STATUSES.PUBLISHED,
      "2026-08-03T00:00:00.000Z",
    );

    const titleOnly = await searchItems(env.FEED_DB, new Request(
      `${ORIGIN}/api/v1/search/?q=needle`,
    ), {
      fields: ["title"],
      limit: 10,
      query: "needle ",
      statuses: ["published"],
    });
    expect(titleOnly.items).toEqual([]);
    const contentOnly = await searchItems(env.FEED_DB, new Request(
      `${ORIGIN}/api/v1/search/?q=needle`,
    ), {
      datePublishedMsGt: Date.parse("2026-07-31T00:00:00.000Z"),
      datePublishedMsLt: Date.parse("2026-08-01T00:00:00.000Z"),
      fields: ["content"],
      limit: 10,
      query: "needle ",
      statuses: ["published"],
    });
    expect(contentOnly.items).toEqual([]);

    let cursor: string | undefined;
    const ordered: Array<{id: string; match_type: string}> = [];
    for (let page = 0; page < 4; page += 1) {
      const response = await searchItems(env.FEED_DB, new Request(
        `${ORIGIN}/api/v1/search/?q=ranked`,
      ), {
        fields: ["title"],
        limit: 1,
        nextCursor: cursor,
        query: "ranked ",
        statuses: ["published"],
      });
      ordered.push(...response.items.map(({id, match_type}) => ({id, match_type})));
      cursor = response.next_cursor;
      if (!cursor) break;
    }
    expect(ordered).toEqual([
      {id: "search-exact-b", match_type: "exact"},
      {id: "search-exact-a", match_type: "exact"},
      {id: "search-fuzzy-page", match_type: "fuzzy"},
    ]);
  });

  it("validates the public API transport and readiness response", async () => {
    const db = await database();
    await save(db, "search-api", "API searchable item", "Stored text");
    const request = new Request(
      `${ORIGIN}/api/v1/search/?q=searchable&fields=title&limit=5`,
    );
    const response = await searchApiItems({
      locals: {feedDb: db, publicBucketUrl: "/media/"},
      request,
    } as APIContext);
    expect(response.status).toBe(200);
    expect(apiSearchResponseSchema.safeParse(await response.json()).success)
      .toBe(true);

    const invalid = await searchApiItems({
      locals: {feedDb: db},
      request: new Request(`${ORIGIN}/api/v1/search/`),
    } as APIContext);
    expect(invalid.status).toBe(400);

    await env.FEED_DB.prepare(
      "UPDATE item_search_metadata SET ready = 0 WHERE id = 1",
    ).run();
    const unavailable = await searchApiItems({
      locals: {feedDb: db},
      request,
    } as APIContext);
    expect(unavailable.status).toBe(503);
    const unavailableRecent = await getAdminItemSearch(
      new Request(`${ORIGIN}/admin/ajax/search/`),
      env,
      "admin",
    );
    expect(unavailableRecent.status).toBe(503);
  });

  it("serves recent and typed results through the protected admin transport", async () => {
    const db = await database();
    await save(db, "search-admin", "Dashboard searchable", "Body");
    const recent = await getAdminItemSearch(
      new Request(`${ORIGIN}/admin/ajax/search/`),
      env,
      "admin",
    );
    expect(recent.status).toBe(200);
    const recentData = await recent.json() as {items: unknown[]};
    expect(recentData.items.length).toBeGreaterThan(0);
    expect(recentData.items.length).toBeLessThanOrEqual(5);

    const typed = await getAdminItemSearch(
      new Request(`${ORIGIN}/admin/ajax/search/?q=serchable`),
      env,
      "admin",
    );
    expect(await typed.json()).toMatchObject({
      items: [expect.objectContaining({
        edit_url: "/admin/items/search-admin/",
        id: "search-admin",
        match_type: "fuzzy",
      })],
    });

    const oneCharacter = await getAdminItemSearch(
      new Request(`${ORIGIN}/admin/ajax/search/?q=s`),
      env,
      "admin",
    );
    expect(await oneCharacter.json()).toEqual({items: []});
  });
});
