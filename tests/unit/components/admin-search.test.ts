import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {describe, expect, it} from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));

describe("admin item search", () => {
  it("places search before theme and uses the shared dialog controls", async () => {
    const [actions, search] = await Promise.all([
      readFile(path.join(
        repositoryRoot,
        "src/components/admin/AdminHeaderActions.tsx",
      ), "utf8"),
      readFile(path.join(
        repositoryRoot,
        "src/components/admin/AdminSearch.tsx",
      ), "utf8"),
    ]);
    expect(actions.indexOf("<AdminSearch")).toBeLessThan(
      actions.indexOf("<AdminThemeMenu"),
    );
    expect(search).toContain('event.metaKey || event.ctrlKey');
    expect(search).toContain('event.key.toLowerCase() === "k"');
    expect(search).toContain("AbortController");
    expect(search).toContain("requestRef.current = null");
    expect(search).toContain("trimmed.length >= 2 ? 200 : 0");
    expect(search).toContain('role="combobox"');
    expect(search).toContain('role="listbox"');
    expect(search).toContain('role="option"');
    expect(search).toContain('event.key === "ArrowDown"');
    expect(search).toContain('event.key === "Enter"');
    expect(search).toContain("Search items...");
    expect(search).toContain("sm:w-44");
    expect(search).toContain("sm:text-xs");
    expect(search).toContain("lg:w-56");
    expect(search).toContain("ml-auto hidden shrink-0");
  });
});
