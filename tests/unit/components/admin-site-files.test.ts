import {describe, expect, it} from "vitest";

import {siteFileEditorLanguage} from "@/components/admin/site-files/SiteFileEditorApp";

describe("Site File editor", () => {
  it("selects format-aware highlighting and leaves plain text unhighlighted", () => {
    expect(siteFileEditorLanguage("application/json")).toBe("json");
    expect(siteFileEditorLanguage("application/manifest+json")).toBe("json");
    expect(siteFileEditorLanguage("application/xml")).toBe("xml");
    expect(siteFileEditorLanguage("application/rss+xml")).toBe("xml");
    expect(siteFileEditorLanguage("text/markdown")).toBe("markdown");
    expect(siteFileEditorLanguage("text/yaml")).toBe("yaml");
    expect(siteFileEditorLanguage("text/css")).toBe("css");
    expect(siteFileEditorLanguage("text/csv")).toBe("csv");
    expect(siteFileEditorLanguage("text/plain")).toBeUndefined();
  });
});
