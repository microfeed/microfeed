import {
  DEFAULT_ITEMS_PER_PAGE,
  MAX_ITEMS_PER_PAGE,
} from "./Constants";
import type {ItemOrder, ItemSort} from "./ItemPagination";
import type {PageRecord} from "./Pages";
import type {SiteFileMediaType} from "./SiteFiles";

export interface AdminItemMediaSummary {
  category?: string;
  durationSecond?: number;
  url?: string;
}

export interface AdminItemSummary {
  createdAtMs: number;
  id: string;
  image?: string;
  mediaFile?: AdminItemMediaSummary;
  pubDateMs: number;
  status: number;
  title: string;
  updatedAtMs: number;
}

export interface AdminItemListResponse {
  items: AdminItemSummary[];
  nextCursor?: number | string;
  order: ItemOrder;
  prevCursor?: number | string;
  sort: ItemSort;
  statusFilter: "all" | "published" | "unlisted" | "unpublished";
}

export type AdminPageSummary = Pick<
  PageRecord,
  | "id"
  | "is_not_found_page"
  | "navigation_label"
  | "navigation_order"
  | "show_in_navigation"
  | "slug"
  | "status"
  | "title"
>;

export interface AdminPageListResponse {
  items: AdminPageSummary[];
  themeSupportsPages: boolean;
}

export interface AdminSiteFileSummary {
  content_type: SiteFileMediaType;
  enabled: boolean;
  filename: string;
  id: string;
}

export interface AdminSiteFileListResponse {
  items: AdminSiteFileSummary[];
}

export function normalizeAdminItemListLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_ITEMS_PER_PAGE;
  }
  return Math.min(Math.trunc(parsed), MAX_ITEMS_PER_PAGE);
}
