import {env} from "cloudflare:workers";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {STATUSES} from "@/shared/Constants";
import {apiFeedSchema} from "@/shared/ApiSchemas";
import FeedDb from "@/server/feed/FeedDb";
import FeedCrudManager from "@/server/feed/FeedCrudManager";
import {jsonFeedResponse} from "@/server/feed/responses";
import {deleteItem, updateItem} from "@/server/items/service";

const ORIGIN = "https://feed.example.com";
const ITEM_ID = "apiitem0001";

async function databaseAndCrud() {
  const request = new Request(`${ORIGIN}/api/items/${ITEM_ID}/`);
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
    const request = new Request(`${ORIGIN}/api/items/${ITEM_ID}/`);

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
