import {env} from "cloudflare:workers";
import {describe, expect, it} from "vitest";

import FeedDb, {getFetchItemsParams} from "@/server/feed/FeedDb";
import {STATUSES} from "@/shared/Constants";
import {ITEM_LIST_SORT_ORDERS} from "@/shared/ItemList";

const ITEMS = [
  {
    id: "item-a",
    pubDate: "2026-08-04T10:00:00.000Z",
    title: "Published first",
    updatedAt: "2026-08-04T13:00:00.000Z",
  },
  {
    id: "item-b",
    pubDate: "2026-08-04T12:00:00.000Z",
    title: "Published last",
    updatedAt: "2026-08-04T11:00:00.000Z",
  },
  {
    id: "item-c",
    pubDate: "2026-08-04T11:00:00.000Z",
    title: "Updated last",
    updatedAt: "2026-08-04T12:00:00.000Z",
  },
  {
    id: "item-d",
    pubDate: "2026-08-04T09:00:00.000Z",
    title: "Updated at the same time",
    updatedAt: "2026-08-04T12:00:00.000Z",
  },
];

describe("admin item list timestamps", () => {
  it("sorts and paginates by updated_at while retaining published sorting", async () => {
    const database = new FeedDb(
      env,
      new Request("https://feed.example.com/admin/items/list/"),
    );
    await database.getContent();
    await env.FEED_DB.batch(ITEMS.map((item) =>
      env.FEED_DB.prepare(
        "INSERT INTO items (id, status, data, pub_date, updated_at) VALUES (?, ?, ?, ?, ?)",
      ).bind(
        item.id,
        STATUSES.PUBLISHED,
        JSON.stringify({title: item.title}),
        item.pubDate,
        item.updatedAt,
      )
    ));

    const updatedPage = await database.getContent({
      fromUrl: {sortOrder: ITEM_LIST_SORT_ORDERS.UPDATED_DESC},
      limit: 2,
      queryKwargs: {"status__!=": STATUSES.DELETED},
    });
    expect(updatedPage.items.map(({id}: {id: string}) => id)).toEqual([
      "item-a",
      "item-c",
    ]);
    expect(updatedPage.items_sort_order).toBe("updated_desc");
    expect(updatedPage.items_next_cursor).toBe(
      `${Date.parse("2026-08-04T12:00:00.000Z")}:item-c`,
    );

    const nextRequest = new Request(
      "https://feed.example.com/admin/items/list/?" +
        new URLSearchParams({
          next_cursor: updatedPage.items_next_cursor,
          sort: ITEM_LIST_SORT_ORDERS.UPDATED_DESC,
        }),
    );
    const nextUpdatedPage = await database.getContent(getFetchItemsParams(
      nextRequest,
      {"status__!=": STATUSES.DELETED},
      2,
    ));
    expect(nextUpdatedPage.items.map(({id}: {id: string}) => id)).toEqual([
      "item-d",
      "item-b",
    ]);

    const publishedPage = await database.getContent({
      fromUrl: {sortOrder: ITEM_LIST_SORT_ORDERS.PUBLISHED_DESC},
      limit: 4,
      queryKwargs: {"status__!=": STATUSES.DELETED},
    });
    expect(publishedPage.items.map(({id}: {id: string}) => id)).toEqual([
      "item-b",
      "item-c",
      "item-a",
      "item-d",
    ]);
  });
});
