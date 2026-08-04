import {STATUSES} from "./Constants";
import {
  applyItemPaginationParams,
  ITEM_ORDERS,
  ITEM_SORTS,
  type ItemOrder,
  type ItemSort,
} from "./ItemPagination";

export const ITEM_STATUS_FILTERS = [
  "all",
  "published",
  "unlisted",
  "unpublished",
] as const;

export type ItemStatusFilter = typeof ITEM_STATUS_FILTERS[number];

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
  nextCursor?: number | string;
  order?: ItemOrder;
  prevCursor?: number | string;
  sort?: ItemSort;
  statusFilter?: unknown;
}

export function buildItemsListUrl({
  nextCursor,
  order = ITEM_ORDERS.DESC,
  prevCursor,
  sort = ITEM_SORTS.UPDATED_AT,
  statusFilter,
}: ItemsListUrlOptions = {}): string {
  const searchParams = new URLSearchParams();
  const normalizedStatus = normalizeItemStatusFilter(statusFilter);

  if (normalizedStatus !== "all") {
    searchParams.set("status", normalizedStatus);
  }
  applyItemPaginationParams(searchParams, {
    nextCursor,
    order,
    prevCursor,
    sort,
  });

  return `?${searchParams.toString()}`;
}
