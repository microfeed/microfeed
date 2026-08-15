import {describe, expect, it} from "vitest";

import {normalizeAdminItemListLimit} from "@/shared/AdminCollections";
import {
  DEFAULT_ITEMS_PER_PAGE,
  MAX_ITEMS_PER_PAGE,
} from "@/shared/Constants";

describe("admin collection settings", () => {
  it("normalizes the configured item page size", () => {
    expect(normalizeAdminItemListLimit(undefined)).toBe(DEFAULT_ITEMS_PER_PAGE);
    expect(normalizeAdminItemListLimit(0)).toBe(DEFAULT_ITEMS_PER_PAGE);
    expect(normalizeAdminItemListLimit(-1)).toBe(DEFAULT_ITEMS_PER_PAGE);
    expect(normalizeAdminItemListLimit("30")).toBe(30);
    expect(normalizeAdminItemListLimit(30.9)).toBe(30);
    expect(normalizeAdminItemListLimit(MAX_ITEMS_PER_PAGE + 1)).toBe(
      MAX_ITEMS_PER_PAGE,
    );
  });
});
