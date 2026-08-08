import {env} from "cloudflare:workers";
import {describe, expect, it} from "vitest";

import FeedDb from "@/server/feed/FeedDb";
import {
  ALL as unsupportedUploadMethod,
  OPTIONS as uploadOptions,
  PUT as uploadMedia,
} from "../../src/pages/media-upload/[...key]";
import {deleteAdminImage} from "../../src/pages/[adminPath]/ajax/r2-ops";
import {updateAdminFeed} from "../../src/pages/[adminPath]/ajax/feed";
import {getMediaResponse} from "@/server/media/media";
import {
  createSignedUpload,
  UPLOAD_TTL_SECONDS,
  verifySignedUpload,
} from "@/server/media/uploads";
import {
  jsonFeedResponse,
  rssFeedResponse,
  sitemapResponse,
} from "@/server/feed/responses";

describe("signed Worker uploads", () => {
  it("signs a 15-minute upload and rejects expiry or tampering", async () => {
    const now = 1_800_000_000;
    const signed = await createSignedUpload(
      new Request("https://feed.example.com/api/media"),
      env,
      {key: "media/audio.mp3", type: "audio/mpeg"},
      now,
    );
    const url = new URL(signed.presignedUrl);
    const objectKey = url.pathname
      .replace("/media-upload/", "")
      .replace(/\/$/u, "");
    expect(signed.mediaBaseUrl).toBe("production");
    expect(url.pathname.endsWith("/")).toBe(false);
    expect(Number(url.searchParams.get("expires"))).toBe(
      now + UPLOAD_TTL_SECONDS,
    );
    await expect(verifySignedUpload(
      objectKey,
      url.searchParams.get("expires"),
      url.searchParams.get("signature"),
      env.UPLOAD_SIGNING_KEY,
      "audio/mpeg",
      now,
    )).resolves.toBe(true);
    await expect(verifySignedUpload(
      `${objectKey}-tampered`,
      url.searchParams.get("expires"),
      url.searchParams.get("signature"),
      env.UPLOAD_SIGNING_KEY,
      "audio/mpeg",
      now,
    )).resolves.toBe(false);
    await expect(verifySignedUpload(
      objectKey,
      url.searchParams.get("expires"),
      url.searchParams.get("signature"),
      env.UPLOAD_SIGNING_KEY,
      "audio/mpeg",
      now + UPLOAD_TTL_SECONDS + 1,
    )).resolves.toBe(false);
  });

  it("uses the development object prefix for local uploads", async () => {
    const signed = await createSignedUpload(
      new Request("http://localhost:4321/admin/ajax/r2-ops/"),
      env,
      {key: "images/channel.png", type: "image/png"},
    );
    const url = new URL(signed.presignedUrl);

    expect(signed.mediaBaseUrl).toBe(
      "development",
    );
    expect(decodeURIComponent(url.pathname)).toContain(
      "/development/images/channel.png",
    );
  });

  it("validates the route and streams the body into R2", async () => {
    const signed = await createSignedUpload(
      new Request("https://feed.example.com/api/media"),
      env,
      {
        key: "media/large-audio.mp3",
        size: 1024 * 1024,
        type: "audio/mpeg",
      },
    );
    const url = new URL(signed.presignedUrl);
    const objectKey = decodeURIComponent(
      url.pathname.replace("/media-upload/", "").replace(/\/$/u, ""),
    );
    const payload = new Uint8Array(1024 * 1024);
    payload.fill(7);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(payload);
        controller.close();
      },
    });
    const request = new Request(url, {
      body,
      duplex: "half",
      method: "PUT",
    } as RequestInit & {duplex: "half"});
    const response = await uploadMedia({
      params: {key: objectKey},
      request,
      url,
    } as any);
    expect(response.status).toBe(200);
    expect((await env.MEDIA_BUCKET.head(objectKey))?.size).toBe(payload.length);

    const tamperedUrl = new URL(url);
    tamperedUrl.searchParams.set("signature", "tampered");
    const rejected = await uploadMedia({
      params: {key: objectKey},
      request: new Request(tamperedUrl, {body: "bad", method: "PUT"}),
      url: tamperedUrl,
    } as any);
    expect(rejected.status).toBe(403);

    const changedSizeUrl = new URL(url);
    changedSizeUrl.searchParams.set("size", "1");
    const changedSize = await uploadMedia({
      params: {key: objectKey},
      request: new Request(changedSizeUrl, {body: "x", method: "PUT"}),
      url: changedSizeUrl,
    } as any);
    expect(changedSize.status).toBe(403);

    const unsupported = await unsupportedUploadMethod({} as any);
    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.get("allow")).toBe("PUT, OPTIONS");
    const preflight = await uploadOptions({} as any);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("replacement image cleanup", () => {
  it("deletes the prior image only after item metadata saves", async () => {
    const suffix = crypto.randomUUID();
    const itemId = `replacement-${suffix}`;
    const oldKey = `production/images/${suffix}-old.png`;
    const newKey = `production/images/${suffix}-new.png`;
    await env.MEDIA_BUCKET.put(oldKey, "old");
    const scheduled: Promise<unknown>[] = [];

    const response = await updateAdminFeed(
      new Request("https://feed.example.com/admin/ajax/feed/", {
        body: JSON.stringify({
          deleteImageUrls: [oldKey],
          item: {
            id: itemId,
            image: newKey,
            pubDateMs: Date.now(),
            status: 1,
            title: "Replacement image",
          },
        }),
        headers: {"content-type": "application/json"},
        method: "POST",
      }),
      env,
      (promise) => scheduled.push(promise),
    );

    expect(response.status).toBe(200);
    expect(scheduled).toHaveLength(1);
    const storedItem = await env.FEED_DB.prepare(
      "SELECT json_extract(data, '$.image') AS image_url FROM items " +
        "WHERE id = ? LIMIT 1",
    ).bind(itemId).first<{image_url: string}>();
    expect(storedItem?.image_url).toBe(newKey);
    await Promise.all(scheduled);
    expect(await env.MEDIA_BUCKET.head(oldKey)).toBeNull();
  });

  it("does not schedule cleanup when metadata cannot be saved", async () => {
    const oldKey = `production/images/${crypto.randomUUID()}-old.png`;
    await env.MEDIA_BUCKET.put(oldKey, "old");
    const scheduled: Promise<unknown>[] = [];

    await expect(updateAdminFeed(
      new Request("https://feed.example.com/admin/ajax/feed/", {
        body: JSON.stringify({
          deleteImageUrls: [oldKey],
          item: {id: "invalid-item", status: 1},
        }),
        headers: {"content-type": "application/json"},
        method: "POST",
      }),
      env,
      (promise) => scheduled.push(promise),
    )).rejects.toThrow();

    expect(scheduled).toHaveLength(0);
    expect(await env.MEDIA_BUCKET.head(oldKey)).not.toBeNull();
  });
});

describe("admin image deletion", () => {
  async function deleteImage(input: unknown) {
    const scheduled: Promise<unknown>[] = [];
    const response = await deleteAdminImage(
      new Request("https://feed.example.com/admin/ajax/r2-ops/", {
        body: JSON.stringify(input),
        method: "DELETE",
      }),
      env,
      (promise) => scheduled.push(promise),
    );
    return {
      response,
      waitForDeletion: () => Promise.all(scheduled),
    };
  }

  it("removes saved metadata before deleting channel, item, and favicon objects", async () => {
    const request = new Request("https://feed.example.com/admin/");
    const database = new FeedDb(env, request);
    await database.getContent();
    const content = await database.getContent();
    const channelKey = "production/images/channel-delete.png";
    const itemKey = "production/images/item-delete.png";
    const faviconKey = "production/images/favicon-delete.png";
    await Promise.all([
      env.MEDIA_BUCKET.put(channelKey, "channel"),
      env.MEDIA_BUCKET.put(itemKey, "item"),
      env.MEDIA_BUCKET.put(faviconKey, "favicon"),
    ]);
    await database.putContent({
      channel: {...content.channel, image: channelKey},
      item: {
        id: "delete-image-item",
        image: itemKey,
        pubDateMs: Date.now(),
        status: 1,
        title: "Delete this image",
      },
      settings: {
        webGlobalSettings: {
          ...content.settings.webGlobalSettings,
          favicon: {contentType: "image/png", url: faviconKey},
        },
      },
    });

    const channelDeletion = await deleteImage({
      imageUrl: channelKey,
      target: {type: "channel"},
    });
    expect(channelDeletion.response.status).toBe(200);
    expect((await database.getContent()).channel.image).toBeUndefined();
    await channelDeletion.waitForDeletion();
    expect(await env.MEDIA_BUCKET.head(channelKey)).toBeNull();

    const itemDeletion = await deleteImage({
      imageUrl: itemKey,
      target: {id: "delete-image-item", type: "item"},
    });
    expect(itemDeletion.response.status).toBe(200);
    const itemRow = await env.FEED_DB.prepare(
      "SELECT data FROM items WHERE id = ?",
    ).bind("delete-image-item").first<{data: string}>();
    expect(JSON.parse(itemRow?.data ?? "{}").image).toBeUndefined();
    await itemDeletion.waitForDeletion();
    expect(await env.MEDIA_BUCKET.head(itemKey)).toBeNull();

    const faviconDeletion = await deleteImage({
      imageUrl: faviconKey,
      target: {type: "favicon"},
    });
    expect(faviconDeletion.response.status).toBe(200);
    expect(
      (await database.getContent()).settings.webGlobalSettings.favicon,
    ).toBeUndefined();
    await faviconDeletion.waitForDeletion();
    expect(await env.MEDIA_BUCKET.head(faviconKey)).toBeNull();
  });

  it("deletes an unsaved new-item upload without creating item metadata", async () => {
    const key = "development/images/unsaved-item.png";
    await env.MEDIA_BUCKET.put(key, "item");
    const countBefore = await env.FEED_DB.prepare(
      "SELECT COUNT(*) AS count FROM items",
    ).first<{count: number}>();

    const deletion = await deleteImage({imageUrl: key});
    expect(deletion.response.status).toBe(200);
    const count = await env.FEED_DB.prepare(
      "SELECT COUNT(*) AS count FROM items",
    ).first<{count: number}>();
    expect(count?.count).toBe(countBefore?.count);
    await deletion.waitForDeletion();
    expect(await env.MEDIA_BUCKET.head(key)).toBeNull();
  });

  it("rejects malformed image deletion requests", async () => {
    const deletion = await deleteImage({
      imageUrl: "production/images/item.png",
      target: {type: "item"},
    });
    expect(deletion.response.status).toBe(400);
    await expect(deletion.response.json()).resolves.toMatchObject({
      error: "Invalid image deletion request.",
    });
  });
});

describe("R2 media responses", () => {
  it("keeps serving project-prefixed legacy objects", async () => {
    const key = "legacy-pages/production/media/audio.mp3";
    await env.MEDIA_BUCKET.put(key, "0123456789", {
      httpMetadata: {
        cacheControl: "public, max-age=86400",
        contentType: "audio/mpeg",
      },
    });

    const full = await getMediaResponse(
      new Request(`https://feed.example.com/media/${key}`),
      env,
      key,
    );
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("audio/mpeg");
    expect(new TextDecoder().decode(await full.arrayBuffer())).toBe(
      "0123456789",
    );

    const head = await getMediaResponse(
      new Request(`https://feed.example.com/media/${key}`, {method: "HEAD"}),
      env,
      key,
    );
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("10");

    const headRange = await getMediaResponse(
      new Request(`https://feed.example.com/media/${key}`, {
        headers: {range: "bytes=2-5"},
        method: "HEAD",
      }),
      env,
      key,
    );
    expect(headRange.status).toBe(206);
    expect(headRange.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(headRange.headers.get("content-length")).toBe("4");

    const ranged = await getMediaResponse(
      new Request(`https://feed.example.com/media/${key}`, {
        headers: {range: "bytes=2-5"},
      }),
      env,
      key,
    );
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(new TextDecoder().decode(await ranged.arrayBuffer())).toBe("2345");

    const conditional = await getMediaResponse(
      new Request(`https://feed.example.com/media/${key}`, {
        headers: {"if-none-match": full.headers.get("etag")!},
      }),
      env,
      key,
    );
    expect(conditional.status).toBe(304);

    const conditionalHead = await getMediaResponse(
      new Request(`https://feed.example.com/media/${key}`, {
        headers: {"if-none-match": full.headers.get("etag")!},
        method: "HEAD",
      }),
      env,
      key,
    );
    expect(conditionalHead.status).toBe(304);

    const weakConditional = await getMediaResponse(
      new Request(`https://feed.example.com/media/${key}`, {
        headers: {"if-none-match": `W/${full.headers.get("etag")!}`},
      }),
      env,
      key,
    );
    expect(weakConditional.status).toBe(304);

    const failedPrecondition = await getMediaResponse(
      new Request(`https://feed.example.com/media/${key}`, {
        headers: {"if-match": "\"not-this-object\""},
      }),
      env,
      key,
    );
    expect(failedPrecondition.status).toBe(412);

    const invalidRange = await getMediaResponse(
      new Request(`https://feed.example.com/media/${key}`, {
        headers: {range: "bytes=100-200"},
      }),
      env,
      key,
    );
    expect(invalidRange.status).toBe(416);

    const missing = await getMediaResponse(
      new Request("https://feed.example.com/media/missing"),
      env,
      "missing",
    );
    expect(missing.status).toBe(404);
  });

  it("initializes the migrated D1 schema idempotently under concurrency", async () => {
    const request = new Request("https://feed.example.com/");
    const contents = await Promise.all(
      Array.from(
        {length: 6},
        () => new FeedDb(env, request).getContent(),
      ),
    );
    const content = contents[0];
    expect(content.channel).toBeTruthy();
    expect(content.channel.copyright).toBe("©{{current_year}}");
    expect(content.settings.webGlobalSettings.publicBucketUrl).toBe("/media/");
    const rows = await env.FEED_DB.prepare(
      "SELECT COUNT(*) AS count FROM channels WHERE is_primary = 1",
    ).first<{count: number}>();
    expect(rows?.count).toBe(1);
  });

  it("keeps feeds and their web-link metadata available in headless mode", async () => {
    const origin = "https://feed.example.com";
    const itemId = "Headless001";
    const request = new Request(`${origin}/json/`);
    const database = new FeedDb(env, request);
    await database.getContent();
    await database.putContent({
      item: {
        id: itemId,
        pubDateMs: Date.now(),
        status: 1,
        title: "Headless item",
      },
      settings: {access: {currentPolicy: "headless"}},
    });

    try {
      const jsonResponse = await jsonFeedResponse(request);
      expect(jsonResponse.status).toBe(200);
      const json = await jsonResponse.json() as {
        home_page_url?: string;
        items: Array<{id?: string; _microfeed?: {web_url?: string}}>;
      };
      const item = json.items.find(({id}) => id === itemId);
      expect(json.home_page_url).toBe(origin);
      expect(item?._microfeed?.web_url).toContain(`/i/headless-item-${itemId}/`);

      const rssResponse = await rssFeedResponse(
        new Request(`${origin}/rss/`),
      );
      expect(rssResponse.status).toBe(200);
      const rss = await rssResponse.text();
      expect(rss).toContain(`${origin}/`);
      expect(rss).toContain(`/i/headless-item-${itemId}/`);

      const itemJsonResponse = await jsonFeedResponse(
        new Request(`${origin}/i/${itemId}/json/`),
        true,
        itemId,
      );
      expect(itemJsonResponse.status).toBe(200);
      const itemRssResponse = await rssFeedResponse(
        new Request(`${origin}/i/${itemId}/rss/`),
        itemId,
      );
      expect(itemRssResponse.status).toBe(200);

      const sitemap = await sitemapResponse(
        new Request(`${origin}/sitemap.xml`),
      );
      expect(sitemap.status).toBe(404);
    } finally {
      await database.putContent({
        settings: {access: {currentPolicy: "public"}},
      });
    }
  });

  it("preserves offline access rules for public routes", async () => {
    const origin = "https://feed.example.com";
    const request = new Request(`${origin}/json/`);
    const database = new FeedDb(env, request);
    await database.getContent();
    await database.putContent({
      settings: {access: {currentPolicy: "offline"}},
    });

    try {
      expect((await jsonFeedResponse(request)).status).toBe(404);
      expect((await rssFeedResponse(
        new Request(`${origin}/rss/`),
      )).status).toBe(404);
      expect((await sitemapResponse(
        new Request(`${origin}/sitemap.xml`),
      )).status).toBe(404);
    } finally {
      await database.putContent({
        settings: {access: {currentPolicy: "public"}},
      });
    }
  });
});
