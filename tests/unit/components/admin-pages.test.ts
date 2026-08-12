import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";

const routeSource = (path: string) => readFile(
  new URL(`../../../src/pages/[adminPath]/pages/${path}/index.astro`, import.meta.url),
  "utf8",
);

describe("admin Page editor routes", () => {
  it("keeps the Quill-based editor out of server rendering", async () => {
    const [newRoute, existingRoute] = await Promise.all([
      routeSource("new"),
      routeSource("[pageId]"),
    ]);

    expect(newRoute).toContain('<PageEditorApp client:only="react"');
    expect(existingRoute).toContain('<PageEditorApp client:only="react"');
    expect(newRoute).not.toContain("<PageEditorApp client:load");
    expect(existingRoute).not.toContain("<PageEditorApp client:load");
  });

  it("delegates one-segment public paths away from the admin home", async () => {
    const adminIndex = await readFile(
      new URL("../../../src/pages/[adminPath]/index.astro", import.meta.url),
      "utf8",
    );

    expect(adminIndex).toContain("loadPublicPageRoute");
    expect(adminIndex).toContain('routeAdminPath === normalizeAdminPath(');
    expect(adminIndex).toContain("<PublicLayout {...publicPage.layout} />");
  });
});
