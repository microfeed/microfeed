import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";

const component = readFile(
  new URL("../../../src/components/public/PublicSearch.astro", import.meta.url),
  "utf8",
);

describe("public search modal", () => {
  it("submits Enter to the full search page", async () => {
    const source = await component;

    expect(source).toContain('<form action="/search/" method="get"');
    expect(source).toContain('name="q"');
    expect(source).toContain('<button type="submit">Search</button>');
    expect(source).toContain('event.key !== "Enter" || event.isComposing');
    expect(source).toContain(
      "(event.currentTarget as HTMLInputElement).form?.requestSubmit()",
    );
    expect(source).not.toContain('method="dialog"');
  });

  it("closes without submitting the search form", async () => {
    const source = await component;

    expect(source).toContain('type="button" aria-label="Close search"');
    expect(source).toContain('[data-microfeed-search-close]');
    expect(source).toContain('addEventListener("click", () => dialog.close())');
  });
});
