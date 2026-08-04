import {ITEMS_SORT_ORDERS, STATUSES} from "./Constants";

export const ITEM_STATUS_FILTERS = [
  "all",
  "published",
  "unlisted",
  "unpublished",
] as const;

export type ItemStatusFilter = typeof ITEM_STATUS_FILTERS[number];

export const ITEM_LIST_SORT_ORDERS = {
  PUBLISHED_ASC: ITEMS_SORT_ORDERS.OLDEST_FIRST,
  PUBLISHED_DESC: ITEMS_SORT_ORDERS.NEWEST_FIRST,
  UPDATED_ASC: "updated_asc",
  UPDATED_DESC: "updated_desc",
} as const;

export type ItemListSortOrder = typeof ITEM_LIST_SORT_ORDERS[
  keyof typeof ITEM_LIST_SORT_ORDERS
];

export interface ItemListCursor {
  id: string;
  timestamp: number;
}

interface ItemListSortDefinition {
  column: "pub_date" | "updated_at";
  descending: boolean;
  order: ItemListSortOrder;
  timestampKey: "pubDateMs" | "updatedAtMs";
}

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

export function normalizeItemListSortOrder(
  value: unknown,
  fallback: ItemListSortOrder = ITEM_LIST_SORT_ORDERS.UPDATED_DESC,
): ItemListSortOrder {
  const values = Object.values(ITEM_LIST_SORT_ORDERS) as string[];
  return values.includes(String(value)) ? value as ItemListSortOrder : fallback;
}

export function itemListSortDefinition(
  value: unknown,
  fallback: ItemListSortOrder = ITEM_LIST_SORT_ORDERS.UPDATED_DESC,
): ItemListSortDefinition {
  const order = normalizeItemListSortOrder(value, fallback);
  const updated = order === ITEM_LIST_SORT_ORDERS.UPDATED_ASC ||
    order === ITEM_LIST_SORT_ORDERS.UPDATED_DESC;
  return {
    column: updated ? "updated_at" : "pub_date",
    descending: order === ITEM_LIST_SORT_ORDERS.UPDATED_DESC ||
      order === ITEM_LIST_SORT_ORDERS.PUBLISHED_DESC,
    order,
    timestampKey: updated ? "updatedAtMs" : "pubDateMs",
  };
}

export function encodeItemListCursor(timestamp: number, id: string): string {
  return `${Math.trunc(timestamp)}:${id}`;
}

export function decodeItemListCursor(value: unknown): ItemListCursor | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const separator = value.indexOf(":");
  if (separator < 1) {
    return undefined;
  }
  const timestamp = Number(value.slice(0, separator));
  const id = value.slice(separator + 1);
  return Number.isFinite(timestamp) && id ? {id, timestamp} : undefined;
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
  prevCursor?: number | string;
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
  if (
    Number.isFinite(nextCursor) ||
    (typeof nextCursor === "string" && nextCursor.length > 0)
  ) {
    searchParams.set("next_cursor", String(nextCursor));
  } else if (
    Number.isFinite(prevCursor) ||
    (typeof prevCursor === "string" && prevCursor.length > 0)
  ) {
    searchParams.set("prev_cursor", String(prevCursor));
  }
  searchParams.set("sort", normalizeItemListSortOrder(sortOrder));

  return `?${searchParams.toString()}`;
}
