import {ITEMS_SORT_ORDERS} from "./Constants";

export const ITEM_SORTS = {
  CREATED_AT: "created_at",
  PUBLISHED_AT: "published_at",
  UPDATED_AT: "updated_at",
} as const;

export type ItemSort = typeof ITEM_SORTS[keyof typeof ITEM_SORTS];

export const ITEM_ORDERS = {
  ASC: "asc",
  DESC: "desc",
} as const;

export type ItemOrder = typeof ITEM_ORDERS[keyof typeof ITEM_ORDERS];

export type LegacyItemSort = typeof ITEMS_SORT_ORDERS[
  keyof typeof ITEMS_SORT_ORDERS
];

export interface ItemCursor {
  id: string;
  timestamp: number;
}

export interface ItemSortDefinition {
  column: "created_at" | "pub_date" | "updated_at";
  sort: ItemSort;
  timestampKey: "createdAtMs" | "pubDateMs" | "updatedAtMs";
}

export interface ResolvedItemPagination extends ItemSortDefinition {
  legacySort?: LegacyItemSort;
  mode: "canonical" | "legacy";
  nextCursor?: ItemCursor | number;
  order: ItemOrder;
  prevCursor?: ItemCursor | number;
}

export interface ItemPaginationDefaults {
  order?: unknown;
  sort?: unknown;
}

export interface ItemPaginationSettings {
  itemsOrder?: unknown;
  itemsSort?: unknown;
  itemsSortOrder?: unknown;
}

export interface ItemPaginationUrlOptions {
  legacySort?: unknown;
  nextCursor?: number | string;
  order?: unknown;
  prevCursor?: number | string;
  sort?: unknown;
}

const ITEM_SORT_DEFINITIONS: Record<ItemSort, ItemSortDefinition> = {
  [ITEM_SORTS.CREATED_AT]: {
    column: "created_at",
    sort: ITEM_SORTS.CREATED_AT,
    timestampKey: "createdAtMs",
  },
  [ITEM_SORTS.PUBLISHED_AT]: {
    column: "pub_date",
    sort: ITEM_SORTS.PUBLISHED_AT,
    timestampKey: "pubDateMs",
  },
  [ITEM_SORTS.UPDATED_AT]: {
    column: "updated_at",
    sort: ITEM_SORTS.UPDATED_AT,
    timestampKey: "updatedAtMs",
  },
};

function encodeUtf8Base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeUtf8Base64Url(value: string): string | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return undefined;
  }
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

export function normalizeItemSort(
  value: unknown,
  fallback: ItemSort = ITEM_SORTS.PUBLISHED_AT,
): ItemSort {
  return Object.values(ITEM_SORTS).includes(value as ItemSort)
    ? value as ItemSort
    : fallback;
}

export function normalizeItemOrder(
  value: unknown,
  fallback: ItemOrder = ITEM_ORDERS.DESC,
): ItemOrder {
  return Object.values(ITEM_ORDERS).includes(value as ItemOrder)
    ? value as ItemOrder
    : fallback;
}

export function normalizeLegacyItemSort(
  value: unknown,
): LegacyItemSort | undefined {
  return Object.values(ITEMS_SORT_ORDERS).includes(value as LegacyItemSort)
    ? value as LegacyItemSort
    : undefined;
}

export function itemSortDefinition(value: unknown): ItemSortDefinition {
  return ITEM_SORT_DEFINITIONS[normalizeItemSort(value)];
}

export function encodeItemCursor(timestamp: number, id: string): string {
  return encodeUtf8Base64Url(JSON.stringify([Math.trunc(timestamp), id]));
}

export function decodeItemCursor(value: unknown): ItemCursor | undefined {
  if (typeof value !== "string" || !value) {
    return undefined;
  }
  const decoded = decodeUtf8Base64Url(value);
  if (!decoded) {
    return undefined;
  }
  try {
    const tuple = JSON.parse(decoded);
    if (
      !Array.isArray(tuple) || tuple.length !== 2 ||
      !Number.isFinite(tuple[0]) || typeof tuple[1] !== "string" || !tuple[1]
    ) {
      return undefined;
    }
    return {id: tuple[1], timestamp: tuple[0]};
  } catch {
    return undefined;
  }
}

export function resolveItemPaginationSettings(
  settings: ItemPaginationSettings = {},
  defaults: ItemPaginationDefaults = {},
): {itemsOrder: ItemOrder; itemsSort: ItemSort} {
  const fallbackSort = normalizeItemSort(defaults.sort);
  const fallbackOrder = normalizeItemOrder(defaults.order);
  const hasCanonicalSort = Object.values(ITEM_SORTS).includes(
    settings.itemsSort as ItemSort,
  );
  const legacySort = normalizeLegacyItemSort(settings.itemsSortOrder);

  if (!hasCanonicalSort && legacySort) {
    return {
      itemsOrder: legacySort === ITEMS_SORT_ORDERS.OLDEST_FIRST
        ? ITEM_ORDERS.ASC
        : ITEM_ORDERS.DESC,
      itemsSort: ITEM_SORTS.PUBLISHED_AT,
    };
  }

  return {
    itemsOrder: normalizeItemOrder(settings.itemsOrder, fallbackOrder),
    itemsSort: normalizeItemSort(settings.itemsSort, fallbackSort),
  };
}

export function resolveItemPagination(
  searchParams: URLSearchParams,
  defaults: ItemPaginationDefaults = {},
): ResolvedItemPagination {
  const requestedSort = searchParams.get("sort");
  const legacySort = normalizeLegacyItemSort(requestedSort);
  const mode = legacySort ? "legacy" : "canonical";
  const sort = mode === "legacy"
    ? ITEM_SORTS.PUBLISHED_AT
    : normalizeItemSort(requestedSort, normalizeItemSort(defaults.sort));
  const order = mode === "legacy"
    ? legacySort === ITEMS_SORT_ORDERS.OLDEST_FIRST
      ? ITEM_ORDERS.ASC
      : ITEM_ORDERS.DESC
    : normalizeItemOrder(
      searchParams.get("order"),
      normalizeItemOrder(defaults.order),
    );
  const definition = itemSortDefinition(sort);
  const nextValue = searchParams.get("next_cursor");
  const prevValue = searchParams.get("prev_cursor");
  const decodeCursor = (value: string | null) => {
    if (!value) {
      return undefined;
    }
    if (mode === "legacy") {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : undefined;
    }
    return decodeItemCursor(value);
  };
  const nextCursor = decodeCursor(nextValue);
  const prevCursor = searchParams.has("next_cursor")
    ? undefined
    : decodeCursor(prevValue);

  return {
    ...definition,
    legacySort,
    mode,
    nextCursor,
    order,
    prevCursor,
  };
}

export function applyItemPaginationParams(
  searchParams: URLSearchParams,
  {
    legacySort,
    nextCursor,
    order,
    prevCursor,
    sort,
  }: ItemPaginationUrlOptions,
): URLSearchParams {
  searchParams.delete("next_cursor");
  searchParams.delete("prev_cursor");
  if (nextCursor !== undefined) {
    searchParams.set("next_cursor", String(nextCursor));
  } else if (prevCursor !== undefined) {
    searchParams.set("prev_cursor", String(prevCursor));
  }

  const normalizedLegacySort = normalizeLegacyItemSort(legacySort);
  if (normalizedLegacySort) {
    searchParams.set("sort", normalizedLegacySort);
    searchParams.delete("order");
  } else {
    searchParams.set("sort", normalizeItemSort(sort));
    searchParams.set("order", normalizeItemOrder(order));
  }
  return searchParams;
}

export function buildItemPaginationUrl(
  baseUrl: string,
  options: ItemPaginationUrlOptions,
): string {
  const url = new URL(baseUrl);
  applyItemPaginationParams(url.searchParams, options);
  return url.toString();
}
