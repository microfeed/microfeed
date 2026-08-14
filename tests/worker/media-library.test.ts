import {env} from "cloudflare:workers";
import {beforeEach, describe, expect, it} from "vitest";

import FeedDb from "@/server/feed/FeedDb";
import {
  deleteMediaLibraryEntry,
  getMediaLibraryEntry,
  listMediaLibrary,
  mediaLibraryEntryByObjectKey,
  MediaLibraryRequestError,
  recordUploadedMedia,
} from "@/server/media/library";
import {createSignedUpload} from "@/server/media/uploads";
import {PUT as uploadMedia} from "../../src/pages/media-upload/[...key]";
import {STATUSES} from "@/shared/Constants";

const ORIGIN = "https://feed.example.com";

async function database(pathname = "/"): Promise<FeedDb> {
  const request = new Request(`${ORIGIN}${pathname}`);
  const db = new FeedDb(env, request);
  await db.getContent();
  return db;
}

beforeEach(async () => {
  await env.FEED_DB.prepare("DELETE FROM media_library").run();
  await env.FEED_DB.prepare("DELETE FROM items WHERE id LIKE 'lib-%'").run();
});

describe("media library service", () => {
  it("records, lists, and deletes library entries", async () => {
    const db = await database();
    const recorded = await recordUploadedMedia(db.FEED_DB, {
      content_type: "image/avif",
      filename: "cover.avif",
      object_key: "production/images/cover.avif",
      size_bytes: 12345,
      url: "/media/production/images/cover.avif",
    });
    expect(recorded.id).toBeTruthy();
    expect(recorded.object_key).toBe("production/images/cover.avif");
    expect(recorded.format).toBe("avif");

    const listed = await listMediaLibrary(db.FEED_DB);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      filename: "cover.avif",
      object_key: "production/images/cover.avif",
    });

    const byKey = await mediaLibraryEntryByObjectKey(
      db.FEED_DB,
      "production/images/cover.avif",
    );
    expect(byKey?.id).toBe(recorded.id);

    const deleted = await deleteMediaLibraryEntry(db.FEED_DB, recorded.id);
    expect(deleted?.id).toBe(recorded.id);
    expect(await listMediaLibrary(db.FEED_DB)).toHaveLength(0);
    expect(await getMediaLibraryEntry(db.FEED_DB, recorded.id)).toBeNull();
  });

  it("updates an existing record when the same object key is re-uploaded", async () => {
    const db = await database();
    await recordUploadedMedia(db.FEED_DB, {
      content_type: "image/png",
      filename: "cover.png",
      object_key: "production/images/cover.png",
      size_bytes: 100,
      url: "/media/production/images/cover.png",
    });
    const updated = await recordUploadedMedia(db.FEED_DB, {
      content_type: "image/avif",
      filename: "cover.avif",
      object_key: "production/images/cover.png",
      size_bytes: 200,
      url: "/media/production/images/cover.png",
    });
    expect(updated.filename).toBe("cover.avif");
    expect(updated.size_bytes).toBe(200);
    expect(await listMediaLibrary(db.FEED_DB)).toHaveLength(1);
  });

  it("rejects invalid library inputs", async () => {
    const db = await database();
    await expect(recordUploadedMedia(db.FEED_DB, {
      object_key: "",
      url: "/media/x",
    })).rejects.toBeInstanceOf(MediaLibraryRequestError);
    await expect(recordUploadedMedia(db.FEED_DB, {
      object_key: "production/images/x.png",
      url: "",
    })).rejects.toBeInstanceOf(MediaLibraryRequestError);
  });

  it("derives the format from the content type", async () => {
    const db = await database();
    const recorded = await recordUploadedMedia(db.FEED_DB, {
      content_type: "image/webp",
      filename: "cover.webp",
      object_key: "production/images/cover.webp",
      url: "/media/production/images/cover.webp",
    });
    expect(recorded.format).toBe("webp");
  });

  it("lets an item reuse a library image as its cover", async () => {
    const db = await database();
    const recorded = await recordUploadedMedia(db.FEED_DB, {
      content_type: "image/avif",
      filename: "shared.avif",
      object_key: "production/images/shared.avif",
      url: "/media/production/images/shared.avif",
    });
    // Reuse: the item stores the library object key as its image URL, exactly
    // like a fresh upload would produce.
    await db.putContent({
      item: {
        description: "<p>Reused cover</p>",
        id: "lib-item-1",
        image: recorded.object_key,
        pubDateMs: Date.parse("2026-08-01T10:00:00.000Z"),
        status: STATUSES.PUBLISHED,
        title: "Reused cover",
      },
    });
    const item = await db.getItemById("lib-item-1", [STATUSES.PUBLISHED]);
    expect(item?.image).toBe("production/images/shared.avif");
  });

  it("records a completed signed upload in the library", async () => {
    const signed = await createSignedUpload(
      new Request("https://feed.example.com/api/media"),
      env,
      {
        key: "images/uploaded.avif",
        size: 64,
        type: "image/avif",
      },
    );
    const url = new URL(signed.presignedUrl);
    const objectKey = decodeURIComponent(
      url.pathname.replace("/media-upload/", "").replace(/\/$/u, ""),
    );
    const payload = new Uint8Array(64);
    payload.fill(9);
    const request = new Request(url, {
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(payload);
          controller.close();
        },
      }),
      duplex: "half",
      method: "PUT",
    } as RequestInit & {duplex: "half"});
    const response = await uploadMedia({
      params: {key: objectKey},
      request,
      url,
    } as any);
    expect(response.status).toBe(200);
    const entry = await mediaLibraryEntryByObjectKey(
      env.FEED_DB,
      objectKey,
    );
    expect(entry).not.toBeNull();
    expect(entry?.content_type).toBe("image/avif");
    expect(entry?.size_bytes).toBe(64);
    expect(entry?.url).toBe(`/media/${objectKey}`);
  });
});
