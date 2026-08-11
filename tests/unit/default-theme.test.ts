import {readFile} from "node:fs/promises";
import path from "node:path";
import {describe, expect, it} from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("bundled theme packages", () => {
  it("keeps default design tokens readable before compiled Tailwind output", async () => {
    const header = await readFile(path.join(root, "themes/default/web-header.mustache"), "utf8");
    expect(header.indexOf('id="microfeed-design-tokens"')).toBe(7);
    expect(header.indexOf('id="microfeed-design-tokens"'))
      .toBeLessThan(header.indexOf('id="microfeed-compiled-styles"'));
    for (const variable of ["accent", "background", "surface", "text", "muted", "border"]) {
      expect(header).toContain(`--mf-${variable}:`);
      expect(header.slice(header.indexOf('id="microfeed-compiled-styles"')))
        .toContain(`var(--mf-${variable})`);
    }
    expect(header).not.toMatch(/<(?:link|script|img)[^>]+(?:href|src)=["']https?:/iu);
  });

  it("ships immutable default and classic package identities without assets", async () => {
    const [modern, classic] = await Promise.all([
      readFile(path.join(root, "themes/default/microfeed-theme.json"), "utf8").then(JSON.parse),
      readFile(path.join(root, "themes/classic/microfeed-theme.json"), "utf8").then(JSON.parse),
    ]);
    expect(modern).toMatchObject({assets: [], packageId: "microfeed.default", version: "1.0.0"});
    expect(classic).toMatchObject({assets: [], packageId: "microfeed.classic", version: "1.0.0"});
  });

  it("keeps the generated theme-authoring skill synchronized", async () => {
    const relative = ".agents/skills/develop-microfeed-theme/SKILL.md";
    const [repository, starter, modern] = await Promise.all([
      readFile(path.join(root, relative), "utf8"),
      readFile(path.join(root, "packages/theme-kit/assets/starter", relative), "utf8"),
      readFile(path.join(root, "themes/default", relative), "utf8"),
    ]);
    expect(starter).toBe(repository);
    expect(modern).toBe(repository);
    expect(repository).toContain("## Bundle CSS and JavaScript");
    expect(repository).toContain("Vite or Webpack output");
    expect(repository).toContain("{{_theme.asset_base_url}}theme.js");
    expect(repository).toContain("uploaded to immutable R2 keys");
    expect(repository).toContain("Never create screenshots unless the user explicitly asks");
  });
});
