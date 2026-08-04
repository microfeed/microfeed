import {env} from "cloudflare:workers";
import {describe, expect, it} from "vitest";

import FeedDb, {getFetchItemsParams} from "@/server/feed/FeedDb";
import {ITEMS_SORT_ORDERS, STATUSES} from "@/shared/Constants";
import {
  decodeItemCursor,
  ITEM_ORDERS,
  ITEM_SORTS,
  type ItemOrder,
  type ItemSort,
} from "@/shared/ItemPagination";

const ITEMS = [
  {
    createdAt: "2026-08-04T10:00:00.000Z",
    id: "pagination-a",
    pubDate: "2026-08-04T10:00:00.000Z",
    title: "Item A",
    updatedAt: "2026-08-04T13:00:00.000Z",
  },
  {
    createdAt: "2026-08-04T11:00:00.000Z",
    id: "pagination-b",
    pubDate: "2026-08-04T12:00:00.000Z",
    title: "Item B",
    updatedAt: "2026-08-04T11:00:00.000Z",
  },
  {
    createdAt: "2026-08-04T11:00:00.000Z",
    id: "pagination-c",
    pubDate: "2026-08-04T11:00:00.000Z",
    title: "Item C",
    updatedAt: "2026-08-04T12:00:00.000Z",
  },
  {
    createdAt: "2026-08-04T12:00:00.000Z",
    id: "pagination-d",
    pubDate: "2026-08-04T09:00:00.000Z",
    title: "Item D",
    updatedAt: "2026-08-04T12:00:00.000Z",
  },
  {
    createdAt: "2026-08-04T13:00:00.000Z",
    id: "pagination-e",
    pubDate: "2026-08-04T11:00:00.000Z",
    title: "Item E",
    updatedAt: "2026-08-04T10:00:00.000Z",
  },
];

const COLUMN_BY_SORT = {
  [ITEM_SORTS.CREATED_AT]: "createdAt",
  [ITEM_SORTS.PUBLISHED_AT]: "pubDate",
  [ITEM_SORTS.UPDATED_AT]: "updatedAt",
} as const;

async function databaseWithItems() {
  const database = new FeedDb(
    env,
    new Request("https://feed.example.com/admin/items/list/"),
  );
  await database.getContent();
  await env.FEED_DB.prepare(
    "DELETE FROM items WHERE id LIKE 'pagination-%' OR id = 'canonical-write'",
  ).run();
  await env.FEED_DB.batch(ITEMS.map((item) =>
    env.FEED_DB.prepare(
      "INSERT INTO items (id, status, data, pub_date, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(
      item.id,
      STATUSES.PUBLISHED,
      JSON.stringify({title: item.title}),
      item.pubDate,
      item.createdAt,
      item.updatedAt,
    )
  ));
  return database;
}

function expectedIds(sort: ItemSort, order: ItemOrder): string[] {
  const column = COLUMN_BY_SORT[sort];
  const direction = order === ITEM_ORDERS.ASC ? 1 : -1;
  return [...ITEMS].sort((left, right) => {
    const timestampDifference = Date.parse(left[column]) - Date.parse(right[column]);
    return direction * (
      timestampDifference || left.id.localeCompare(right.id)
    );
  }).map(({id}) => id);
}

async function page(
  database: FeedDb,
  searchParams: Record<string, string>,
) {
  const request = new Request(
    `https://feed.example.com/admin/items/list/?${new URLSearchParams(searchParams)}`,
  );
  return database.getContent(getFetchItemsParams(
    request,
    {"status__!=": STATUSES.DELETED},
    2,
  ));
}

describe("deterministic item pagination", () => {
  it("writes canonical item timestamps instead of SQLite defaults", async () => {
    const database = new FeedDb(
      env,
      new Request("https://feed.example.com/admin/items/list/"),
    );
    await database.getContent();
    await env.FEED_DB.prepare(
      "DELETE FROM items WHERE id = ?",
    ).bind("canonical-write").run();

    await database.putContent({
      item: {
        id: "canonical-write",
        pubDateMs: Date.parse("2026-08-04T12:00:00.000Z"),
        status: STATUSES.PUBLISHED,
        title: "Canonical timestamps",
      },
    });

    const row = await env.FEED_DB.prepare(
      "SELECT created_at, updated_at FROM items WHERE id = ?",
    ).bind("canonical-write").first<{
      created_at: string;
      updated_at: string;
    }>();
    expect(row?.created_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u,
    );
    expect(row?.updated_at).toBe(row?.created_at);
    await env.FEED_DB.prepare(
      "DELETE FROM items WHERE id = ?",
    ).bind("canonical-write").run();
  });

  it("navigates both directions for every canonical key and order with ties", async () => {
    const database = await databaseWithItems();

    for (const sort of Object.values(ITEM_SORTS)) {
      for (const order of Object.values(ITEM_ORDERS)) {
        const forwardPages: string[][] = [];
        const seenIds: string[] = [];
        let response = await page(database, {order, sort});

        while (true) {
          const ids = response.items.map(({id}: {id: string}) => id);
          expect(ids).not.toHaveLength(0);
          forwardPages.push(ids);
          seenIds.push(...ids);
          expect(response.items_sort).toBe(sort);
          expect(response.items_order).toBe(order);
          expect(response.items_sort_order).toBeUndefined();
          if (!response.items_next_cursor) break;
          expect(decodeItemCursor(response.items_next_cursor)).toBeDefined();
          response = await page(database, {
            next_cursor: response.items_next_cursor,
            order,
            sort,
          });
        }

        expect(seenIds).toEqual(expectedIds(sort, order));
        expect(new Set(seenIds).size).toBe(ITEMS.length);

        for (let index = forwardPages.length - 2; index >= 0; index -= 1) {
          expect(response.items_prev_cursor).toBeDefined();
          response = await page(database, {
            order,
            prev_cursor: response.items_prev_cursor,
            sort,
          });
          expect(response.items.map(({id}: {id: string}) => id)).toEqual(
            forwardPages[index],
          );
        }
        expect(response.items_prev_cursor).toBeUndefined();
      }
    }
  });

  it("keeps explicit legacy sorting numeric and ignores order", async () => {
    const database = await databaseWithItems();
    const firstPage = await page(database, {
      order: ITEM_ORDERS.ASC,
      sort: ITEMS_SORT_ORDERS.NEWEST_FIRST,
    });

    expect(firstPage.items.map(({id}: {id: string}) => id)).toEqual([
      "pagination-b",
      "pagination-c",
    ]);
    expect(firstPage.items_next_cursor).toBe(
      Date.parse("2026-08-04T11:00:00.000Z"),
    );
    expect(firstPage.items_sort_order).toBe(ITEMS_SORT_ORDERS.NEWEST_FIRST);
    expect(firstPage.items_sort).toBeUndefined();
    expect(firstPage.items_order).toBeUndefined();
  });

  it("falls back to the first page for malformed or mode-mismatched cursors", async () => {
    const database = await databaseWithItems();
    const expected = expectedIds(ITEM_SORTS.UPDATED_AT, ITEM_ORDERS.DESC)
      .slice(0, 2);
    const malformed = await page(database, {
      next_cursor: "malformed",
      order: ITEM_ORDERS.DESC,
      prev_cursor: "also-malformed",
      sort: ITEM_SORTS.UPDATED_AT,
    });
    const numeric = await page(database, {
      next_cursor: String(Date.parse("2026-08-04T12:00:00.000Z")),
      order: ITEM_ORDERS.DESC,
      sort: ITEM_SORTS.UPDATED_AT,
    });

    expect(malformed.items.map(({id}: {id: string}) => id)).toEqual(expected);
    expect(numeric.items.map(({id}: {id: string}) => id)).toEqual(expected);
    expect(malformed.items_prev_cursor).toBeUndefined();
  });
});
