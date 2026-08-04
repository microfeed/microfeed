import {describe, expect, it} from "vitest";

import {ITEMS_SORT_ORDERS, STATUSES} from "@/shared/Constants";
import {
  buildItemsListUrl,
  itemQueryForStatusFilter,
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
      sortOrder: ITEMS_SORT_ORDERS.OLDEST_FIRST,
      statusFilter: "unlisted",
    })).toBe("?status=unlisted&next_cursor=123&sort=oldest_first");

    expect(buildItemsListUrl({
      prevCursor: 456,
      sortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
      statusFilter: "all",
    })).toBe("?prev_cursor=456&sort=newest_first");
  });
});
