import {env} from "cloudflare:workers";
import {describe, expect, it} from "vitest";

import FeedDb from "@/server/feed/FeedDb";
import {
  ALL as unsupportedUploadMethod,
  OPTIONS as uploadOptions,
  PUT as uploadMedia,
} from "../../src/pages/media-upload/[...key]";
import {getMediaResponse} from "@/server/media/media";
import {
  createSignedUpload,
  UPLOAD_TTL_SECONDS,
  verifySignedUpload,
} from "@/server/media/uploads";
import {jsonFeedResponse} from "@/server/feed/responses";

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
    expect(content.settings.webGlobalSettings.publicBucketUrl).toBe("/media/");
    const rows = await env.FEED_DB.prepare(
      "SELECT COUNT(*) AS count FROM channels WHERE is_primary = 1",
    ).first<{count: number}>();
    expect(rows?.count).toBe(1);
  });

  it("preserves offline access rules for public feed routes", async () => {
    const request = new Request("https://feed.example.com/json/");
    const database = new FeedDb(env, request);
    const content = await database.getContent();
    content.settings.access.currentPolicy = "offline";
    await database.putContent(content);
    const response = await jsonFeedResponse(
      request,
    );
    expect(response.status).toBe(404);
  });
});
