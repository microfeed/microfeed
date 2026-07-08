import {ITEMS_SORT_ORDERS, STATUSES} from "../../common-src/Constants";
import ChannelRepo from "./ChannelRepo";
import ItemRepo from "./ItemRepo";
import SettingsRepo from "./SettingsRepo";

const {createMigratedInMemoryDatabase} = require("../../test-utils/d1-substitute");

function makeItem(id, contentType, slug, pubDateMs, extra = {}) {
  return {
    id,
    status: STATUSES.PUBLISHED,
    content_type: contentType,
    slug,
    pub_date: new Date(pubDateMs).toISOString(),
    data: JSON.stringify({title: id, ...extra}),
  };
}

describe("Repositories", () => {
  test("ItemRepo supports get-by-id, list+paginate, update, upsert, and slug uniqueness per type", async () => {
    const db = createMigratedInMemoryDatabase();
    const itemRepo = new ItemRepo(db);

    try {
      await itemRepo.insert(makeItem("item_a", "blog_article", "shared-slug", Date.parse("2026-07-01T00:00:00.000Z")));
      await itemRepo.insert(makeItem("item_b", "photo", "shared-slug", Date.parse("2026-07-03T00:00:00.000Z")));
      await itemRepo.insert(makeItem("item_c", "blog_article", "other-slug", Date.parse("2026-07-02T00:00:00.000Z")));

      let duplicateInsertFailed = false;
      try {
        await itemRepo.insert(makeItem("item_d", "blog_article", "shared-slug", Date.parse("2026-07-04T00:00:00.000Z")));
      } catch (error) {
        duplicateInsertFailed = true;
      }
      expect(duplicateInsertFailed).toBe(true);

      expect(await itemRepo.getById("item_a")).toMatchObject({
        id: "item_a",
        content_type: "blog_article",
        slug: "shared-slug",
      });

      expect(await itemRepo.getByTypeAndSlug("blog_article", "shared-slug")).toMatchObject({
        id: "item_a",
      });

      await itemRepo.update("item_a", {
        status: STATUSES.UNPUBLISHED,
      });
      expect(await itemRepo.getById("item_a")).toMatchObject({
        status: STATUSES.UNPUBLISHED,
      });

      await itemRepo.upsert({
        id: "item_a",
        status: STATUSES.PUBLISHED,
        content_type: "blog_article",
        slug: "shared-slug",
        pub_date: new Date(Date.parse("2026-07-05T00:00:00.000Z")).toISOString(),
        data: JSON.stringify({title: "updated"}),
      });
      expect(await itemRepo.getById("item_a")).toMatchObject({
        status: STATUSES.PUBLISHED,
        slug: "shared-slug",
        data: JSON.stringify({title: "updated"}),
      });

      const firstPage = await itemRepo.listPaginated({
        queryKwargs: {
          status__in: [STATUSES.PUBLISHED, STATUSES.UNPUBLISHED],
        },
        limit: 2,
        sortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
      });
      expect(firstPage.results.map((row) => row.id)).toEqual(["item_a", "item_b"]);
      expect(firstPage.items_next_cursor).toBe(Date.parse("2026-07-03T00:00:00.000Z"));

      const nextPage = await itemRepo.listPaginated({
        queryKwargs: {
          status__in: [STATUSES.PUBLISHED, STATUSES.UNPUBLISHED],
        },
        limit: 2,
        sortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
        nextCursor: firstPage.items_next_cursor,
      });
      expect(nextPage.results.map((row) => row.id)).toEqual(["item_c"]);
      expect(nextPage.items_prev_cursor).toBe(Date.parse("2026-07-02T00:00:00.000Z"));
    } finally {
      db.close();
    }
  });

  test("ChannelRepo and SettingsRepo round-trip through upsert", async () => {
    const db = createMigratedInMemoryDatabase();
    const channelRepo = new ChannelRepo(db);
    const settingsRepo = new SettingsRepo(db);

    try {
      await channelRepo.insert({
        id: "channel_1",
        status: STATUSES.PUBLISHED,
        is_primary: 1,
        data: JSON.stringify({title: "Initial"}),
      });
      await channelRepo.upsert({
        id: "channel_1",
        status: STATUSES.UNPUBLISHED,
        is_primary: 1,
        data: JSON.stringify({title: "Updated"}),
      });

      expect(await channelRepo.getById("channel_1")).toMatchObject({
        id: "channel_1",
        status: STATUSES.UNPUBLISHED,
        is_primary: 1,
        data: JSON.stringify({title: "Updated"}),
      });
      expect(await channelRepo.getPrimaryPublished()).toBeNull();

      await channelRepo.update("channel_1", {
        status: STATUSES.PUBLISHED,
      });
      expect(await channelRepo.getPrimaryPublished()).toMatchObject({
        id: "channel_1",
        status: STATUSES.PUBLISHED,
      });

      await settingsRepo.upsert({
        category: "webGlobalSettings",
        data: JSON.stringify({itemsPerPage: 20}),
      });
      await settingsRepo.upsert({
        category: "webGlobalSettings",
        data: JSON.stringify({itemsPerPage: 30}),
      });

      expect(await settingsRepo.getById("webGlobalSettings")).toMatchObject({
        category: "webGlobalSettings",
        data: JSON.stringify({itemsPerPage: 30}),
      });
      expect((await settingsRepo.listAll()).results).toHaveLength(1);
    } finally {
      db.close();
    }
  });
});
