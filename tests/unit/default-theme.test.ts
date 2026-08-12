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
    const [bodyStart, classicBodyStart, feed, item] = await Promise.all([
      readFile(path.join(root, "themes/default/web-body-start.mustache"), "utf8"),
      readFile(path.join(root, "themes/classic/web-body-start.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-feed.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-item.mustache"), "utf8"),
    ]);
    expect(bodyStart).toBe(classicBodyStart);
    for (const template of [feed, item]) {
      expect(template).toContain('class="mf-site-nav"');
      expect(template).toContain("data-microfeed-search-open");
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
    expect(sourceStyles).toMatch(/@media only screen and \(max-width: 600px\)\s*\{[\s\S]*?html:not\(\.rss-document\)\s*\{[\s\S]*?padding-right:\s*1em;[\s\S]*?padding-left:\s*1em;/u);
    expect(sourceStyles).not.toMatch(/footer\s*\{[^}]*position:\s*fixed/gu);
  });

  it("uses a responsive search field and overflows navigation after two pages", async () => {
    const [feed, item, page, search, siteNavigation, sourceStyles, sourceScript] = await Promise.all([
      readFile(path.join(root, "themes/default/web-feed.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-item.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-page.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-search.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/src/templates/site-nav.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/src/theme.css"), "utf8"),
      readFile(path.join(root, "themes/default/src/main.ts"), "utf8"),
    ]);

    for (const template of [feed, item, page, search]) {
      expect(template).toContain('class="mf-site-search"');
      expect(template).toContain('type="search"');
      expect(template).toContain('class="mf-search-icon-button"');
      expect(template).toContain("data-microfeed-nav-overflow");
      expect(template.indexOf('class="mf-site-search"'))
        .toBeLessThan(template.indexOf('class="mf-nav-links"'));
      expect(template).not.toContain('href="/">Home</a>');
    }
    expect(siteNavigation).toContain("readonly");
    expect(siteNavigation).toContain('aria-haspopup="dialog"');
    expect(siteNavigation).toContain('aria-controls="microfeed-search-dialog"');
    expect(siteNavigation).toContain("data-microfeed-search-open");
    expect(siteNavigation).not.toContain("data-microfeed-search-input");
    expect(siteNavigation).not.toContain("data-microfeed-search-results");
    expect(feed).not.toContain('class="mf-back-link"');
    for (const template of [item, page, search]) {
      expect(template).toContain('class="mf-back-link"');
      expect(template).toContain('<div class="icon-arrow-left">{{title}}</div>');
    }

    expect(sourceScript).toContain("if (links.length <= 2) continue");
    expect(sourceScript).toContain("for (const link of links.slice(2))");
    expect(sourceStyles).toMatch(/\.mf-site-search\s*\{[\s\S]*?display:\s*grid;/u);
    expect(sourceStyles).toMatch(/\.mf-site-nav\s*\{[\s\S]*?justify-content:\s*space-between;/u);
    expect(sourceStyles).toMatch(/\.mf-nav-links\s*\{[\s\S]*?margin-left:\s*auto;/u);
    expect(sourceStyles).not.toMatch(/\.mf-site-search\s*\{[^}]*margin-left:\s*auto;/u);
    expect(sourceStyles).toMatch(/@media only screen and \(max-width: 600px\)[\s\S]*?\.mf-site-search\s*\{\s*display:\s*none;/u);
    expect(sourceStyles).toMatch(/@media only screen and \(max-width: 600px\)[\s\S]*?\.mf-search-icon-button\s*\{[\s\S]*?display:\s*inline-flex;/u);
    expect(sourceStyles).toMatch(/html \.mf-public-search\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?margin:\s*auto;/u);
    expect(search).toContain('class="mf-visually-hidden"');
    expect(search).toContain('class="mf-search-control"');
    expect(search).toContain('name="q"');
    expect(search).toContain('<button type="submit">');
    expect(search).toContain('<span>Search</span>');
    const searchFormStart = search.indexOf('<form action="/search/"');
    const searchFormEnd = search.indexOf("</form>", searchFormStart);
    const searchResults = search.indexOf("data-microfeed-search-results");
    expect(searchResults).toBeGreaterThan(searchFormStart);
    expect(searchResults).toBeLessThan(searchFormEnd);
    expect(sourceStyles).toMatch(/\.mf-search-page-results\s*\{[\s\S]*?margin-top:\s*1\.25rem;/u);
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
    const [application, modern, classic] = await Promise.all([
      readFile(path.join(root, "package.json"), "utf8").then(JSON.parse),
      readFile(path.join(root, "themes/default/microfeed-theme.json"), "utf8").then(JSON.parse),
      readFile(path.join(root, "themes/classic/microfeed-theme.json"), "utf8").then(JSON.parse),
    ]);
    expect(modern).toMatchObject({
      assets: [],
      formatVersion: 2,
      packageId: "microfeed.default",
      version: "1.1.4",
    });
    expect(application.version).toBe("1.0.4");
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
