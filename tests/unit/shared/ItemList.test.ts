import {describe, expect, it} from "vitest";

import {ITEMS_SORT_ORDERS, STATUSES} from "@/shared/Constants";
import {
  buildItemsListUrl,
  itemQueryForStatusFilter,
  normalizeItemStatusFilter,
} from "@/shared/ItemList";
import {
  buildItemPaginationUrl,
  decodeItemCursor,
  encodeItemCursor,
  ITEM_ORDERS,
  ITEM_SORTS,
  resolveItemPagination,
  resolveItemPaginationSettings,
} from "@/shared/ItemPagination";

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

  it("keeps the filter, sort key, and order in pagination links", () => {
    expect(buildItemsListUrl({
      nextCursor: "cursor_value",
      order: ITEM_ORDERS.ASC,
      sort: ITEM_SORTS.UPDATED_AT,
      statusFilter: "unlisted",
    })).toBe(
      "?status=unlisted&next_cursor=cursor_value&sort=updated_at&order=asc",
    );
    expect(buildItemsListUrl({
      order: ITEM_ORDERS.DESC,
      prevCursor: "previous_value",
      sort: ITEM_SORTS.CREATED_AT,
      statusFilter: "all",
    })).toBe(
      "?prev_cursor=previous_value&sort=created_at&order=desc",
    );
  });
});

describe("item pagination contract", () => {
  it("round-trips unpadded Base64URL timestamp and ID cursors", () => {
    const cursor = encodeItemCursor(1_800_000_000_123, "item_abc-123");

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(cursor).not.toContain("=");
    expect(decodeItemCursor(cursor)).toEqual({
      id: "item_abc-123",
      timestamp: 1_800_000_000_123,
    });
    expect(decodeItemCursor("not+a+base64url+cursor")).toBeUndefined();
  });

  it("resolves canonical defaults and ignores malformed or mismatched cursors", () => {
    const defaults = resolveItemPagination(new URLSearchParams(), {
      order: ITEM_ORDERS.DESC,
      sort: ITEM_SORTS.UPDATED_AT,
    });
    expect(defaults).toMatchObject({
      column: "updated_at",
      mode: "canonical",
      order: "desc",
      sort: "updated_at",
      timestampKey: "updatedAtMs",
    });

    const numericCursor = resolveItemPagination(new URLSearchParams({
      next_cursor: "1800000000123",
      order: "asc",
      sort: "created_at",
    }));
    expect(numericCursor.nextCursor).toBeUndefined();

    const obsoleteSort = resolveItemPagination(new URLSearchParams({
      sort: "updated_desc",
    }));
    expect(obsoleteSort).toMatchObject({
      mode: "canonical",
      order: "desc",
      sort: "published_at",
    });
  });

  it("gives next cursor precedence and requires the cursor mode to match", () => {
    const cursor = encodeItemCursor(1_800_000_000_123, "item-a");
    const canonical = resolveItemPagination(new URLSearchParams({
      next_cursor: cursor,
      prev_cursor: encodeItemCursor(1_700_000_000_000, "item-b"),
      sort: "updated_at",
    }));
    expect(canonical.nextCursor).toEqual({
      id: "item-a",
      timestamp: 1_800_000_000_123,
    });
    expect(canonical.prevCursor).toBeUndefined();

    const malformedNext = resolveItemPagination(new URLSearchParams({
      next_cursor: "invalid",
      prev_cursor: cursor,
      sort: "updated_at",
    }));
    expect(malformedNext.nextCursor).toBeUndefined();
    expect(malformedNext.prevCursor).toBeUndefined();
  });

  it("keeps explicit legacy requests numeric and ignores order", () => {
    const legacy = resolveItemPagination(new URLSearchParams({
      next_cursor: "1800000000123",
      order: "asc",
      sort: ITEMS_SORT_ORDERS.NEWEST_FIRST,
    }));
    expect(legacy).toMatchObject({
      legacySort: "newest_first",
      mode: "legacy",
      nextCursor: 1_800_000_000_123,
      order: "desc",
      sort: "published_at",
    });
    expect(resolveItemPagination(new URLSearchParams({
      next_cursor: encodeItemCursor(1_800_000_000_123, "item-a"),
      sort: ITEMS_SORT_ORDERS.OLDEST_FIRST,
    })).nextCursor).toBeUndefined();
  });

  it("maps legacy settings but produces canonical, escaped URLs", () => {
    expect(resolveItemPaginationSettings({
      itemsSortOrder: ITEMS_SORT_ORDERS.OLDEST_FIRST,
    })).toEqual({itemsOrder: "asc", itemsSort: "published_at"});
    expect(resolveItemPaginationSettings({
      itemsOrder: "desc",
      itemsSort: "created_at",
      itemsSortOrder: ITEMS_SORT_ORDERS.OLDEST_FIRST,
    })).toEqual({itemsOrder: "desc", itemsSort: "created_at"});

    expect(buildItemPaginationUrl("https://feed.example/json/", {
      nextCursor: "a_cursor-with-symbols",
      order: ITEM_ORDERS.ASC,
      sort: ITEM_SORTS.CREATED_AT,
    })).toBe(
      "https://feed.example/json/?next_cursor=a_cursor-with-symbols&sort=created_at&order=asc",
    );
  });
});
