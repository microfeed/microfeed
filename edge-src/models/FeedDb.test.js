import FeedDb from "./FeedDb";
import {ITEMS_SORT_ORDERS, STATUSES} from "../../common-src/Constants";

const {createMigratedInMemoryDatabase} = require("../../test-utils/d1-substitute");

function makeFeedDb(db) {
  return new FeedDb({FEED_DB: db}, {url: "https://example.com/"});
}

describe("FeedDb facade", () => {
  test("seeds a fresh database with a channel id and default settings", async () => {
    const db = createMigratedInMemoryDatabase();
    const feedDb = makeFeedDb(db);

    try {
      const content = await feedDb.getContent();

      expect(content.channel).toMatchObject({
        id: expect.any(String),
        status: STATUSES.PUBLISHED,
        is_primary: 1,
      });
      expect(content.settings).toMatchObject({
        webGlobalSettings: expect.objectContaining({
          itemsSortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
        }),
      });
      expect(content.items).toEqual([]);
    } finally {
      db.close();
    }
  });

  test("persists and reads channel, settings, items, and pagination through the repo layer", async () => {
    const db = createMigratedInMemoryDatabase();
    const feedDb = makeFeedDb(db);

    try {
      await feedDb.putContent({
        channel: {
          id: "channel_1",
          status: STATUSES.PUBLISHED,
          is_primary: 1,
          title: "Example",
          link: "https://example.com",
        },
        settings: {
          webGlobalSettings: {
            itemsSortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
            itemsPerPage: 1,
          },
          access: {
            currentPolicy: "public",
          },
        },
        item: {
          id: "item_1",
          status: STATUSES.PUBLISHED,
          content_type: "blog_article",
          slug: "hello-world",
          pubDateMs: Date.parse("2026-07-03T00:00:00.000Z"),
          title: "Hello world",
          description: "Body",
        },
      });

      const content = await feedDb.getContent({
        queryKwargs: {
          status__in: [STATUSES.PUBLISHED],
        },
        limit: 1,
        fromUrl: {
          sortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
        },
      });

      expect(content.channel).toMatchObject({
        id: "channel_1",
        title: "Example",
      });
      expect(content.settings.webGlobalSettings.itemsPerPage).toBe(1);
      expect(content.items).toHaveLength(1);
      expect(content.items[0]).toMatchObject({
        id: "item_1",
        content_type: "blog_article",
        slug: "hello-world",
      });
      expect(content.items_sort_order).toBe(ITEMS_SORT_ORDERS.NEWEST_FIRST);
      expect(content.items_next_cursor).toBe(Date.parse("2026-07-03T00:00:00.000Z"));
    } finally {
      db.close();
    }
  });
});
