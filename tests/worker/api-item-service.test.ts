import {env} from "cloudflare:workers";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {STATUSES} from "@/shared/Constants";
import {apiFeedSchema} from "@/shared/ApiSchemas";
import {API_BASE_PATH} from "@/shared/ApiVersion";
import FeedDb from "@/server/feed/FeedDb";
import FeedCrudManager from "@/server/feed/FeedCrudManager";
import {jsonFeedResponse} from "@/server/feed/responses";
import {createItem, deleteItem, updateItem} from "@/server/items/service";

const ORIGIN = "https://feed.example.com";
const ITEM_ID = "apiitem0001";

async function databaseAndCrud() {
  const request = new Request(`${ORIGIN}${API_BASE_PATH}items/${ITEM_ID}/`);
  const database = new FeedDb(env, request);
  const content = await database.getContent();
  return {
    crud: new FeedCrudManager(content, database, request),
    database,
  };
}

beforeEach(async () => {
  const {database} = await databaseAndCrud();
  await env.FEED_DB.prepare("DELETE FROM items WHERE id = ?")
    .bind(ITEM_ID).run();
  await database._updateOrAddSetting({
    access: {currentPolicy: "public"},
  }, "access");
});

afterEach(async () => {
  await env.FEED_DB.prepare("DELETE FROM items WHERE id = ?")
    .bind(ITEM_ID).run();
});

describe("transport-neutral item service", () => {
  it("derives stored content_text and ignores caller-supplied text", async () => {
    const {crud, database} = await databaseAndCrud();
    const id = await createItem(crud, {
      content_html: "<p>Canonical &amp; searchable</p>",
      content_text: "caller value must be ignored",
      id: ITEM_ID,
      title: "Normalized item",
    });
    const item = await database.getItemById(id);
    expect(item?.contentText).toBe("Canonical & searchable");
    const stored = await env.FEED_DB.prepare(
      "SELECT content_text, data FROM items WHERE id = ?",
    ).bind(id).first<{content_text: string; data: string}>();
    expect(stored?.content_text).toBe("Canonical & searchable");
    expect(JSON.parse(stored!.data)).not.toHaveProperty("content_text");
    await updateItem(database, crud, id, {content_html: ""});
    expect((await database.getItemById(id))?.contentText).toBe("");
    await env.FEED_DB.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
  });

  it("preserves omitted fields, the GUID, attachments, and publication date", async () => {
    const {crud, database} = await databaseAndCrud();
    const publishedAt = "2026-08-01T10:00:00.000Z";
    await env.FEED_DB.prepare(
      "INSERT INTO items (id, status, data, pub_date, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(
      ITEM_ID,
      STATUSES.UNLISTED,
      JSON.stringify({
        description: "Keep this body",
        guid: "stable-guid",
        mediaFile: {
          category: "audio",
          contentType: "audio/mpeg",
          sizeByte: 1234,
          url: "media/episode.mp3",
        },
        title: "Old title",
      }),
      publishedAt,
      publishedAt,
      publishedAt,
    ).run();

    const updated = await updateItem(database, crud, ITEM_ID, {
      title: "New title",
    });
    expect(updated).toMatchObject({
      description: "Keep this body",
      guid: "stable-guid",
      id: ITEM_ID,
      mediaFile: {sizeByte: 1234, url: "media/episode.mp3"},
      status: STATUSES.UNLISTED,
      title: "New title",
    });
    const row = await env.FEED_DB.prepare(
      "SELECT data, pub_date FROM items WHERE id = ?",
    ).bind(ITEM_ID).first<{data: string; pub_date: string}>();
    expect(row?.pub_date).toBe(publishedAt);
    expect(JSON.parse(row!.data)).toMatchObject({
      description: "Keep this body",
      guid: "stable-guid",
      mediaFile: {sizeByte: 1234},
      title: "New title",
    });

    const publicFeed = await database.getPublicJsonData({
      ...crud.feedContent,
      items: [updated],
    }, true);
    expect(publicFeed.items[0]).toMatchObject({
      attachments: [{size_in_byte: 1234, size_in_bytes: 1234}],
      date_modified: expect.any(String),
      id: ITEM_ID,
    });
    const parsedFeed = apiFeedSchema.safeParse(publicFeed);
    expect(
      parsedFeed.success,
      parsedFeed.success ? undefined : JSON.stringify(parsedFeed.error.issues),
    ).toBe(true);
  });

  it("returns not found instead of creating mutation targets", async () => {
    const {crud, database} = await databaseAndCrud();
    expect(await updateItem(database, crud, ITEM_ID, {title: "Nope"}))
      .toBeNull();
    expect(await deleteItem(database, crud, ITEM_ID)).toBe(false);
    expect(await env.FEED_DB.prepare(
      "SELECT count(*) AS count FROM items WHERE id = ?",
    ).bind(ITEM_ID).first()).toEqual({count: 0});
  });

  it("finalizes the GUI draft-date marker for explicit API publication changes", async () => {
    const {crud, database} = await databaseAndCrud();
    const originalDate = "2026-08-01T10:00:00.000Z";
    await env.FEED_DB.prepare(
      "INSERT INTO items (id, status, data, pub_date) VALUES (?, ?, ?, ?)",
    ).bind(
      ITEM_ID,
      STATUSES.UNPUBLISHED,
      JSON.stringify({
        pubDateIsDraftDefault: true,
        title: "GUI draft",
      }),
      originalDate,
    ).run();

    const titleOnly = await updateItem(database, crud, ITEM_ID, {
      title: "Still a draft",
    });
    expect(titleOnly?.pubDateIsDraftDefault).toBe(true);

    const customDate = "2026-09-01T18:30:00.000Z";
    const dated = await updateItem(database, crud, ITEM_ID, {
      date_published: customDate,
    });
    expect(dated?.pubDateIsDraftDefault).toBe(false);
    expect(dated?.pubDateMs).toBe(Date.parse(customDate));

    await env.FEED_DB.prepare(
      "UPDATE items SET status = ?, data = ? WHERE id = ?",
    ).bind(
      STATUSES.UNPUBLISHED,
      JSON.stringify({
        pubDateIsDraftDefault: true,
        title: "Draft again",
      }),
      ITEM_ID,
    ).run();
    const published = await updateItem(database, crud, ITEM_ID, {
      status: "published",
    });
    expect(published?.status).toBe(STATUSES.PUBLISHED);
    expect(published?.pubDateIsDraftDefault).toBe(false);
    expect(published?.pubDateMs).toBe(Date.parse(customDate));
  });

  it("stores same-site item-image and attachment URLs without duplicating the media path", async () => {
    const {crud, database} = await databaseAndCrud();
    await env.FEED_DB.prepare(
      "INSERT INTO items (id, status, data, pub_date) VALUES (?, ?, ?, ?)",
    ).bind(
      ITEM_ID,
      STATUSES.UNLISTED,
      JSON.stringify({title: "Image item"}),
      "2026-08-01T10:00:00.000Z",
    ).run();

    const updated = await updateItem(database, crud, ITEM_ID, {
      attachments: [{
        category: "image",
        mime_type: "image/png",
        size_in_bytes: 4321,
        url: `${ORIGIN}/media/production/media/image-original.png`,
      }],
      image: `${ORIGIN}/media/production/media/image.png`,
    });
    expect(updated?.image).toBe("production/media/image.png");
    expect(updated?.mediaFile).toMatchObject({
      category: "image",
      contentType: "image/png",
      sizeByte: 4321,
      url: "production/media/image-original.png",
    });

    const publicFeed = await database.getPublicJsonData({
      ...crud.feedContent,
      items: [updated],
    }, true);
    expect(publicFeed.items[0]?.image).toBe(
      "/media/production/media/image.png",
    );
    expect(publicFeed.items[0]?.attachments).toEqual([expect.objectContaining({
      mime_type: "image/png",
      size_in_bytes: 4321,
      url: "/media/production/media/image-original.png",
    })]);
  });

  it("allows authenticated-style reads while the public feed is Offline", async () => {
    const {database} = await databaseAndCrud();
    await env.FEED_DB.prepare(
      "INSERT INTO items (id, status, data, pub_date) VALUES (?, ?, ?, ?)",
    ).bind(
      ITEM_ID,
      STATUSES.UNPUBLISHED,
      JSON.stringify({title: "Private draft"}),
      "2026-08-01T10:00:00.000Z",
    ).run();
    await database._updateOrAddSetting({
      access: {currentPolicy: "offline"},
    }, "access");
    const request = new Request(
      `${ORIGIN}${API_BASE_PATH}items/${ITEM_ID}/`,
    );

    const authenticated = await jsonFeedResponse(
      request,
      false,
      ITEM_ID,
      [STATUSES.PUBLISHED, STATUSES.UNLISTED, STATUSES.UNPUBLISHED],
      false,
    );
    expect(authenticated.status).toBe(200);
    const authenticatedFeed = await authenticated.json() as {
      items: Array<Record<string, unknown>>;
    };
    expect(authenticatedFeed.items[0]).toMatchObject({
      id: ITEM_ID,
      title: "Private draft",
    });

    const publicResponse = await jsonFeedResponse(
      request,
      false,
      ITEM_ID,
      [STATUSES.PUBLISHED, STATUSES.UNLISTED, STATUSES.UNPUBLISHED],
      true,
    );
    expect(publicResponse.status).toBe(404);
  });
});
