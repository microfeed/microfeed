import {describe, expect, it} from "vitest";

import {STATUSES} from "@/shared/Constants";
import {
  buildItemsListUrl,
  decodeItemListCursor,
  encodeItemListCursor,
  ITEM_LIST_SORT_ORDERS,
  itemQueryForStatusFilter,
  itemListSortDefinition,
  normalizeItemListSortOrder,
  normalizeItemStatusFilter,
} from "@/shared/ItemList";

describe("admin item list filters", () => {
  it("normalizes known filters and falls back to all items", () => {
    expect(normalizeItemStatusFilter("unlisted")).toBe("unlisted");
    expect(normalizeItemStatusFilter(" PUBLISHED ")).toBe("published");
    expect(normalizeItemStatusFilter("deleted")).toBe("all");
  });

  it("turns status filters into database queries", () => {
    expect(itemQueryForStatusFilter("published")).toEqual({
      status: STATUSES.PUBLISHED,
    });
    expect(itemQueryForStatusFilter("unlisted")).toEqual({
      status: STATUSES.UNLISTED,
    });
    expect(itemQueryForStatusFilter("unpublished")).toEqual({
      status: STATUSES.UNPUBLISHED,
    });
    expect(itemQueryForStatusFilter("all")).toEqual({
      "status__!=": STATUSES.DELETED,
    });
  });

  it("keeps the filter and sort order in pagination links", () => {
    expect(buildItemsListUrl({
      nextCursor: 123,
      sortOrder: ITEM_LIST_SORT_ORDERS.UPDATED_ASC,
      statusFilter: "unlisted",
    })).toBe("?status=unlisted&next_cursor=123&sort=updated_asc");

    expect(buildItemsListUrl({
      prevCursor: 456,
      sortOrder: ITEM_LIST_SORT_ORDERS.PUBLISHED_DESC,
      statusFilter: "all",
    })).toBe("?prev_cursor=456&sort=newest_first");
  });

  it("defaults the admin list to the most recently updated items", () => {
    expect(normalizeItemListSortOrder(undefined)).toBe("updated_desc");
    expect(itemListSortDefinition("updated_desc")).toEqual({
      column: "updated_at",
      descending: true,
      order: "updated_desc",
      timestampKey: "updatedAtMs",
    });
    expect(itemListSortDefinition("oldest_first")).toMatchObject({
      column: "pub_date",
      descending: false,
      timestampKey: "pubDateMs",
    });
  });

  it("round-trips tied timestamp cursors with an item id", () => {
    const cursor = encodeItemListCursor(1_800_000_000_123, "item_abc-123");
    expect(cursor).toBe("1800000000123:item_abc-123");
    expect(decodeItemListCursor(cursor)).toEqual({
      id: "item_abc-123",
      timestamp: 1_800_000_000_123,
    });
    expect(buildItemsListUrl({
      nextCursor: cursor,
      sortOrder: ITEM_LIST_SORT_ORDERS.UPDATED_DESC,
      statusFilter: "all",
    })).toBe(
      "?next_cursor=1800000000123%3Aitem_abc-123&sort=updated_desc",
    );
  });
});
