import {describe, expect, it} from "vitest";

import {
  normalizeSiteFilenameInput,
  SITE_FILE_MAX_NAME_LENGTH,
} from "@/shared/SiteFiles";

describe("Site File editor values", () => {
  it("normalizes a one-level root filename before saving", () => {
    expect(normalizeSiteFilenameInput("/Security.TXT/")).toBe("security.txt");
    expect(normalizeSiteFilenameInput("/docs/security.txt"))
      .toBe("docssecurity.txt");
    expect(normalizeSiteFilenameInput("docs\\security.txt"))
      .toBe("docssecurity.txt");
    expect(normalizeSiteFilenameInput(
      `/${"a".repeat(SITE_FILE_MAX_NAME_LENGTH + 1)}.txt/`,
    )).toHaveLength(SITE_FILE_MAX_NAME_LENGTH);
  });
});
