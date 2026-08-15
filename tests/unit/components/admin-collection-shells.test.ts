import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";

const routeSource = (path: string) => readFile(
  new URL(`../../../src/pages/[adminPath]/${path}/index.astro`, import.meta.url),
  "utf8",
);

describe("admin collection shells", () => {
  it("renders lightweight shells and lets client islands fetch list data", async () => {
    const [items, pages, siteFiles] = await Promise.all([
      routeSource("items/list"),
      routeSource("pages"),
      routeSource("site-files"),
    ]);

    expect(items).toContain('<AllItemsApp client:only="react"');
    expect(items).toContain("{itemsPerPage} {publicBucketUrl}");
    expect(items).not.toContain(
      '<AllItemsApp client:only="react" {feedContent}>',
    );

    expect(pages).toContain('<PagesApp client:only="react"');
    expect(pages).not.toContain("await listPages");
    expect(pages).not.toContain("await activeThemeSupportsPages");

    expect(siteFiles).toContain('<SiteFilesApp client:only="react"');
    expect(siteFiles).not.toContain("await listSiteFiles");

    for (const source of [items, pages, siteFiles]) {
      expect(source).toContain('<AdminPageFallback slot="fallback" kind="list"');
    }
  });
});
