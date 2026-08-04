import {ITEMS_SORT_ORDERS, STATUSES} from "./Constants";

export const ITEM_STATUS_FILTERS = [
  "all",
  "published",
  "unlisted",
  "unpublished",
] as const;

export type ItemStatusFilter = typeof ITEM_STATUS_FILTERS[number];
export type ItemsSortOrder = typeof ITEMS_SORT_ORDERS[keyof typeof ITEMS_SORT_ORDERS];

const ITEM_STATUS_BY_FILTER = {
  published: STATUSES.PUBLISHED,
  unlisted: STATUSES.UNLISTED,
  unpublished: STATUSES.UNPUBLISHED,
} as const;

export function normalizeItemStatusFilter(value: unknown): ItemStatusFilter {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ITEM_STATUS_FILTERS.includes(normalized as ItemStatusFilter)
    ? normalized as ItemStatusFilter
    : "all";
}

export function normalizeItemsSortOrder(value: unknown): ItemsSortOrder {
  return value === ITEMS_SORT_ORDERS.OLDEST_FIRST
    ? ITEMS_SORT_ORDERS.OLDEST_FIRST
    : ITEMS_SORT_ORDERS.NEWEST_FIRST;
}

export function itemQueryForStatusFilter(
  value: unknown,
): Record<string, number> {
  const statusFilter = normalizeItemStatusFilter(value);
  if (statusFilter === "all") {
    return {"status__!=": STATUSES.DELETED};
  }

  return {status: ITEM_STATUS_BY_FILTER[statusFilter]};
}

interface ItemsListUrlOptions {
  nextCursor?: number;
  prevCursor?: number;
  sortOrder?: unknown;
  statusFilter?: unknown;
}

export function buildItemsListUrl({
  nextCursor,
  prevCursor,
  sortOrder,
  statusFilter,
}: ItemsListUrlOptions = {}): string {
  const searchParams = new URLSearchParams();
  const normalizedStatus = normalizeItemStatusFilter(statusFilter);

  if (normalizedStatus !== "all") {
    searchParams.set("status", normalizedStatus);
  }
  if (Number.isFinite(nextCursor)) {
    searchParams.set("next_cursor", String(nextCursor));
  } else if (Number.isFinite(prevCursor)) {
    searchParams.set("prev_cursor", String(prevCursor));
  }
  searchParams.set("sort", normalizeItemsSortOrder(sortOrder));

  return `?${searchParams.toString()}`;
}
