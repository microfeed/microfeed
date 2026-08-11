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

  it("keeps the default familiar while anchoring its footer on short pages", async () => {
    const sharedFiles = [
      "web-body-start.mustache",
      "web-feed.mustache",
      "web-item.mustache",
    ];
    for (const filename of sharedFiles) {
      const [modern, classic] = await Promise.all([
        readFile(path.join(root, "themes/default", filename), "utf8"),
        readFile(path.join(root, "themes/classic", filename), "utf8"),
      ]);
      expect(modern, filename).toBe(classic);
    }

    const [bodyEnd, classicBodyEnd, sourceStyles] = await Promise.all([
      readFile(path.join(root, "themes/default/web-body-end.mustache"), "utf8"),
      readFile(path.join(root, "themes/classic/web-body-end.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/src/theme.css"), "utf8"),
    ]);
    expect(bodyEnd.startsWith(classicBodyEnd)).toBe(true);
    expect(sourceStyles).toMatch(/body\s*\{[\s\S]*?display:\s*flex;[\s\S]*?min-height:\s*calc\(100dvh - 3em\);[\s\S]*?flex-direction:\s*column;/u);
    expect(sourceStyles).toMatch(/main\s*\{[\s\S]*?flex:\s*1 0 auto;/u);
    expect(sourceStyles).toMatch(/footer\s*\{[\s\S]*?flex:\s*none;/u);
    expect(sourceStyles).not.toContain("position: fixed");
  });

  it("renders RSS as a responsive page aligned with the default theme", async () => {
    const [rssStylesheet, rssSource, sourceStyles] = await Promise.all([
      readFile(path.join(root, "themes/default/rss-stylesheet.xsl"), "utf8"),
      readFile(path.join(root, "themes/default/src/templates/rss-stylesheet.xsl"), "utf8"),
      readFile(path.join(root, "themes/default/src/theme.css"), "utf8"),
    ]);
    expect(rssStylesheet).toContain('<xsl:stylesheet version="1.0"');
    expect(rssStylesheet).toContain('name="viewport"');
    expect(rssStylesheet).toContain('class="rss-container"');
    expect(rssStylesheet).toContain("max-width:50rem");
    expect(rssStylesheet).toContain("width&lt;=600px");
    expect(rssStylesheet).toContain("rss/channel/atom:link[@rel='next']");
    expect(rssStylesheet).toContain("var(--mf-accent)");
    expect(rssStylesheet).not.toContain("microfeed:compiled-tailwind");
    expect(rssSource).toContain("microfeed:compiled-tailwind");
    expect(sourceStyles).toContain("@media only screen and (max-width: 600px)");
    expect(rssStylesheet).not.toContain("fade(black");
    expect(rssStylesheet).not.toContain('"Noto\n');
  });

  it("ships immutable default and classic package identities without assets", async () => {
    const [modern, classic] = await Promise.all([
      readFile(path.join(root, "themes/default/microfeed-theme.json"), "utf8").then(JSON.parse),
      readFile(path.join(root, "themes/classic/microfeed-theme.json"), "utf8").then(JSON.parse),
    ]);
    expect(modern).toMatchObject({assets: [], packageId: "microfeed.default", version: "1.0.2"});
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
