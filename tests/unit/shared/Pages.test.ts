import {describe, expect, it} from "vitest";

import {
  normalizePageSlugInput,
  PAGE_META_DESCRIPTION_MAX_LENGTH,
  PAGE_SLUG_MAX_LENGTH,
} from "@/shared/Pages";

describe("Page editor values", () => {
  it("normalizes one-segment path input before saving", () => {
    expect(normalizePageSlugInput("/About/")).toBe("about");
    expect(normalizePageSlugInput("/docs/about/")).toBe("docsabout");
    expect(normalizePageSlugInput(`/${"a".repeat(PAGE_SLUG_MAX_LENGTH + 1)}/`))
      .toHaveLength(PAGE_SLUG_MAX_LENGTH);
  });

  it("matches the published meta-description length", () => {
    expect(PAGE_META_DESCRIPTION_MAX_LENGTH).toBe(155);
  });
});
