import {env} from "cloudflare:workers";
import {describe, expect, it, vi} from "vitest";

import {
  applyWorkerCachePolicy,
  PRIVATE_CACHE_CONTROL,
  PUBLIC_CACHE_BROWSER_CONTROL,
  PUBLIC_CACHE_EDGE_CONTROL,
  PUBLIC_CACHE_TAGS,
  publicCacheTagsForFeedUpdate,
  purgePublicCache,
} from "@/server/cache/public-cache";
import FeedDb from "@/server/feed/FeedDb";
import {SETTINGS_CATEGORIES, STATUSES} from "@/shared/Constants";
import {encodeItemCursor} from "@/shared/ItemPagination";

const ITEM_ID = "cacheitem01";

function policy(
  path: string,
  response = new Response("ok"),
  init?: RequestInit,
) {
  return applyWorkerCachePolicy(
    new Request(`https://feed.example.com${path}`, init),
    response,
    {adminPath: "secret-admin", deploymentEnvironment: "production"},
  );
}

describe("Workers Caching response policy", () => {
  it("caches public pages at the edge while browsers revalidate", () => {
    const response = policy("/");

    expect(response.headers.get("cache-control")).toBe(
      PUBLIC_CACHE_BROWSER_CONTROL,
    );
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      PUBLIC_CACHE_EDGE_CONTROL,
    );
    expect(response.headers.get("cache-tag")?.split(",")).toEqual([
      PUBLIC_CACHE_TAGS.PUBLIC,
      PUBLIC_CACHE_TAGS.CHANNEL_PRIMARY,
      PUBLIC_CACHE_TAGS.ITEMS,
      PUBLIC_CACHE_TAGS.THEME_CURRENT,
    ]);
  });

  it("tags item representations independently from aggregate pages", () => {
    const tags = policy(`/i/a-title-${ITEM_ID}/json/`)
      .headers.get("cache-tag")?.split(",");

    expect(tags).toEqual([
      PUBLIC_CACHE_TAGS.PUBLIC,
      PUBLIC_CACHE_TAGS.CHANNEL_PRIMARY,
      PUBLIC_CACHE_TAGS.item(ITEM_ID),
    ]);
  });

  it.each([
    ["admin", "/secret-admin/", undefined],
    ["versioned API", "/api/v1/items/", undefined],
    ["legacy API", "/api/items/", undefined],
    ["authentication", "/api/auth/get-session", undefined],
    ["mutation", "/", {method: "POST"}],
    ["unknown query", "/?nonce=random", undefined],
  ])("does not cache %s responses", (_name, path, init) => {
    const response = policy(path, new Response("ok"), init);

    expect(response.headers.get("cache-control")).toBe(PRIVATE_CACHE_CONTROL);
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      "no-store",
    );
    expect(response.headers.has("cache-tag")).toBe(false);
  });

  it("bypasses Workers Caching without weakening public asset headers", () => {
    const response = policy("/media/audio.mp3", new Response("audio", {
      headers: {"cache-control": "public, max-age=3600"},
    }));

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=3600",
    );
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      "no-store",
    );
    expect(response.headers.has("cache-tag")).toBe(false);
  });

  it("does not cache previews, errors, authenticated requests, or cookies", () => {
    const preview = applyWorkerCachePolicy(
      new Request("https://feed.example.com/"),
      new Response("ok"),
      {adminPath: "admin", deploymentEnvironment: "preview"},
    );
    const error = policy("/missing/", new Response("missing", {status: 404}));
    const authorized = policy("/", new Response("ok"), {
      headers: {authorization: "Bearer secret"},
    });
    const cookieResponse = policy("/", new Response("ok", {
      headers: {"set-cookie": "session=secret"},
    }));

    for (const response of [preview, error, authorized, cookieResponse]) {
      expect(response.headers.get("cache-control")).toBe(
        PRIVATE_CACHE_CONTROL,
      );
    }
  });

  it("allows bounded, valid pagination query parameters", () => {
    const cursor = encodeItemCursor(1_800_000_000_000, ITEM_ID);
    const response = policy(
      `/?sort=updated_at&order=desc&next_cursor=${cursor}`,
    );

    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      PUBLIC_CACHE_EDGE_CONTROL,
    );
  });
});

describe("Workers cache invalidation", () => {
  it("maps item, channel, theme, and general setting writes to tags", () => {
    expect(publicCacheTagsForFeedUpdate({
      channel: {},
      item: {id: ITEM_ID},
      settings: {
        [SETTINGS_CATEGORIES.API_SETTINGS]: {enabled: true},
        [SETTINGS_CATEGORIES.CUSTOM_CODE]: {},
        [SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS]: {},
      },
    })).toEqual([
      PUBLIC_CACHE_TAGS.ITEMS,
      PUBLIC_CACHE_TAGS.item(ITEM_ID),
      PUBLIC_CACHE_TAGS.CHANNEL_PRIMARY,
      PUBLIC_CACHE_TAGS.THEME_CURRENT,
      PUBLIC_CACHE_TAGS.PUBLIC,
    ]);
  });

  it("deduplicates tags before calling the platform purge API", async () => {
    const purge = vi.fn(async () => ({errors: [], success: true}));

    await purgePublicCache(
      [PUBLIC_CACHE_TAGS.ITEMS, PUBLIC_CACHE_TAGS.ITEMS],
      {purge},
    );

    expect(purge).toHaveBeenCalledWith({tags: [PUBLIC_CACHE_TAGS.ITEMS]});
  });

  it("purges item tags immediately after a successful D1 write", async () => {
    const purge = vi.fn(async () => ({errors: [], success: true}));
    const database = new FeedDb(
      {
        DEPLOYMENT_ENVIRONMENT: "production",
        FEED_DB: env.FEED_DB,
        MICROFEED_CLOUDFLARE_ACCOUNT_ID: "test-account-id",
      },
      new Request("https://feed.example.com/api/v1/items/"),
      {purge},
    );
    await database.getContent();

    await database.putContent({
      item: {
        id: ITEM_ID,
        pubDateMs: Date.now(),
        status: STATUSES.PUBLISHED,
        title: "Cached item",
      },
    });

    expect(purge).toHaveBeenLastCalledWith({
      tags: [PUBLIC_CACHE_TAGS.ITEMS, PUBLIC_CACHE_TAGS.item(ITEM_ID)],
    });
  });

  it("does not purge from a preview deployment", async () => {
    const purge = vi.fn(async () => ({errors: [], success: true}));
    const database = new FeedDb(
      {
        DEPLOYMENT_ENVIRONMENT: "preview",
        FEED_DB: env.FEED_DB,
        MICROFEED_CLOUDFLARE_ACCOUNT_ID: "test-account-id",
      },
      new Request("https://preview.example.com/admin/ajax/feed/"),
      {purge},
    );

    await database.putContent({
      item: {
        id: ITEM_ID,
        pubDateMs: Date.now(),
        status: STATUSES.PUBLISHED,
        title: "Preview item",
      },
    });

    expect(purge).not.toHaveBeenCalled();
  });
});
