import {readFile} from "node:fs/promises";
import path from "node:path";
import {describe, expect, it} from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

function occurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

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

  it("renders one shared navigation and footer around every web view", async () => {
    const [bodyStart, bodyEnd, feed, item, page, search, sourceStyles] = await Promise.all([
      readFile(path.join(root, "themes/default/web-body-start.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-body-end.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-feed.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-item.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-page.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-search.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/src/theme.css"), "utf8"),
    ]);
    expect(bodyStart).toContain("Shared navigation rendered immediately after <body>");
    expect(occurrences(bodyStart, 'class="mf-site-nav"')).toBe(1);
    expect(occurrences(bodyStart, 'class="mf-site-search"')).toBe(1);
    expect(occurrences(bodyStart, 'class="mf-search-icon-button"')).toBe(1);
    expect(occurrences(bodyStart, "data-microfeed-search-open")).toBe(2);
    expect(occurrences(bodyStart, 'class="mf-nav-overflow"')).toBe(1);
    expect(bodyEnd).toContain("<footer");
    // Fork customization: the "Powered by microfeed" footer credit is removed.
    expect(bodyEnd).not.toContain("Powered by");
    expect(bodyEnd).toContain("<script>");
    for (const template of [feed, item, page, search]) {
      expect(template).not.toContain('class="mf-site-nav"');
      expect(template).not.toContain("data-microfeed-search-open");
      const document = `${bodyStart}${template}${bodyEnd}`;
      expect(occurrences(document, 'class="mf-site-nav"')).toBe(1);
      expect(occurrences(document, "<footer")).toBe(1);
    }

    expect(sourceStyles).toMatch(/body\s*\{[\s\S]*?display:\s*flex;[\s\S]*?min-height:\s*calc\(100dvh - 3em\);[\s\S]*?flex-direction:\s*column;/u);
    expect(sourceStyles).toMatch(/\.mf-site-nav\s*\{[\s\S]*?flex:\s*none;/u);
    expect(sourceStyles).toMatch(/main\s*\{[\s\S]*?flex:\s*1 0 auto;/u);
    expect(sourceStyles).toMatch(/footer\s*\{[\s\S]*?flex:\s*none;/u);
    expect(sourceStyles).toMatch(
      /\.mf-footer-link,[\s\S]*?\.mf-footer-link:visited\s*\{\s*color:\s*#19b7fa;/u,
    );
    expect(sourceStyles).toMatch(/@media only screen and \(max-width: 600px\)\s*\{[\s\S]*?html:not\(\.rss-document\)\s*\{[\s\S]*?padding-right:\s*1em;[\s\S]*?padding-left:\s*1em;/u);
    expect(sourceStyles).not.toMatch(/footer\s*\{[^}]*position:\s*fixed/gu);
  });

  it("uses responsive search and collapses Page links into a mobile menu", async () => {
    const [bodyStart, feed, item, page, search, sourceStyles, sourceScript] = await Promise.all([
      readFile(path.join(root, "themes/default/web-body-start.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-feed.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-item.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-page.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/web-search.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/src/theme.css"), "utf8"),
      readFile(path.join(root, "themes/default/src/main.ts"), "utf8"),
    ]);

    for (const template of [feed, item, page, search]) {
      expect(template).not.toContain('class="mf-site-search"');
      expect(template).not.toContain('class="mf-search-icon-button"');
      expect(template).not.toContain("data-microfeed-nav-overflow");
      expect(template).not.toContain('href="/">Home</a>');
    }
    expect(bodyStart).toContain('class="mf-site-search"');
    expect(bodyStart).toContain('type="search"');
    expect(bodyStart).toContain('class="mf-search-icon-button"');
    expect(bodyStart).toContain("data-microfeed-nav-overflow");
    expect(bodyStart).toContain('class="mf-nav-overflow-menu-icon"');
    expect(bodyStart.indexOf('class="mf-site-brand"'))
      .toBeLessThan(bodyStart.indexOf('class="mf-nav-links"'));
    expect(bodyStart.indexOf('class="mf-nav-links"'))
      .toBeLessThan(bodyStart.indexOf('class="mf-site-search"'));
    expect(bodyStart.indexOf('class="mf-site-search"'))
      .toBeLessThan(bodyStart.indexOf('class="mf-theme-menu"'));
    expect(bodyStart).toContain("readonly");
    expect(bodyStart).toContain('aria-haspopup="dialog"');
    expect(bodyStart).toContain('aria-controls="microfeed-search-dialog"');
    expect(bodyStart).toContain("data-microfeed-search-open");
    expect(bodyStart).not.toContain("data-microfeed-search-input");
    expect(bodyStart).not.toContain("data-microfeed-search-results");
    expect(feed).not.toContain('class="mf-back-link"');
    for (const template of [item, page, search]) {
      expect(template).toContain('class="mf-back-link"');
      expect(template).toContain('<div class="icon-arrow-left">{{title}}</div>');
    }

    expect(sourceScript).toContain('window.matchMedia("(max-width: 600px)")');
    expect(sourceScript).toContain("if (mobileNavigation.matches)");
    expect(sourceScript).toContain("for (const link of links) menu.append(link)");
    expect(sourceScript).toContain("for (const link of links.slice(0, 2))");
    expect(sourceScript).toContain("for (const link of links.slice(2))");
    expect(sourceStyles).toMatch(/\.mf-site-search\s*\{[\s\S]*?display:\s*grid;/u);
    expect(sourceStyles).toMatch(/\.mf-site-search\s*\{[\s\S]*?width:\s*min\(13\.5rem, 38vw\);/u);
    expect(sourceStyles).toMatch(/\.mf-site-search input\[type="search"\]\s*\{[\s\S]*?font-size:\s*0\.875rem;/u);
    expect(sourceStyles).toMatch(/\.mf-site-nav\s*\{[\s\S]*?justify-content:\s*space-between;/u);
    expect(sourceStyles).toMatch(/\.mf-site-search\s*\{[\s\S]*?margin-left:\s*auto;/u);
    expect(sourceStyles).not.toMatch(/\.mf-nav-links\s*\{[^}]*margin-left:\s*auto;/u);
    expect(sourceStyles).toMatch(/@media only screen and \(max-width: 600px\)[\s\S]*?\.mf-site-search\s*\{\s*display:\s*none;/u);
    expect(sourceStyles).toMatch(/@media only screen and \(max-width: 600px\)[\s\S]*?\.mf-search-icon-button\s*\{[\s\S]*?display:\s*inline-flex;/u);
    expect(sourceStyles).toMatch(/@media only screen and \(max-width: 600px\)[\s\S]*?\.mf-nav-links > a\s*\{[\s\S]*?display:\s*none;/u);
    expect(sourceStyles).toMatch(/@media only screen and \(max-width: 600px\)[\s\S]*?\.mf-nav-overflow-menu-icon\s*\{[\s\S]*?display:\s*block;/u);
    expect(sourceStyles).toMatch(/html \.mf-public-search\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?margin:\s*auto;/u);
    expect(sourceStyles).toMatch(/\.mf-nav-overflow summary:hover\s*\{[\s\S]*?opacity:\s*65%;/u);
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
    expect(search).toContain("data-microfeed-search-details");
    expect(sourceStyles).toMatch(/\.mf-search-page-results\s*\{[\s\S]*?margin-top:\s*1\.25rem;/u);
    expect(sourceStyles).toMatch(/\.mf-search-page-results \.mf-public-search-result__details\s*\{[\s\S]*?-webkit-line-clamp:\s*2;/u);
    expect(sourceStyles).toMatch(/\.mf-search-page-results \.mf-public-search-result__details mark\s*\{[\s\S]*?background:\s*color-mix\(/u);
  });

  it("keeps a consistent gap between every rendered rich-text block", async () => {
    const [feed, item, page, sourceStyles] = await Promise.all([
      readFile(path.join(root, "themes/default/src/templates/web-feed.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/src/templates/web-item.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/src/templates/web-page.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/src/theme.css"), "utf8"),
    ]);

    for (const template of [feed, item, page]) {
      expect(template).toContain('class="mf-rich-content"');
    }
    expect(sourceStyles).toMatch(
      /\.mf-rich-content \{[\s\S]*?--mf-rich-block-gap:\s*1rem;[\s\S]*?line-height:\s*1\.6;/u,
    );
    expect(sourceStyles).toMatch(
      /\.mf-rich-content > \* \{\s*margin-block:\s*0;\s*\}/u,
    );
    expect(sourceStyles).toMatch(
      /\.mf-rich-content > \* \+ \* \{\s*margin-top:\s*var\(--mf-rich-block-gap\);\s*\}/u,
    );
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
    expect(rssStylesheet).toContain('class="mf-footer-link"');
    expect(rssSource).toContain('class="mf-footer-link"');
    expect(rssStylesheet).toContain("var(--mf-accent)");
    expect(rssStylesheet).not.toContain("microfeed:compiled-tailwind");
    expect(rssSource).toContain("microfeed:compiled-tailwind");
    expect(sourceStyles).toContain("@media only screen and (max-width: 600px)");
    expect(rssStylesheet).not.toContain("fade(black");
    expect(rssStylesheet).not.toContain('"Noto\n');
  });

  it("ships one immutable bundled default package with representative demo content", async () => {
    const [application, fixture, modern] = await Promise.all([
      readFile(path.join(root, "package.json"), "utf8").then(JSON.parse),
      readFile(path.join(root, "themes/default/fixtures/editorial.json"), "utf8")
        .then(JSON.parse),
      readFile(path.join(root, "themes/default/microfeed-theme.json"), "utf8").then(JSON.parse),
    ]);
    expect(modern).toMatchObject({
      assets: [],
      description: "A minimalist, responsive feed for text, audio, video, images, documents, standalone Pages, and search.",
      formatVersion: 2,
      packageId: "microfeed.default",
      previewFixture: "fixtures/editorial.json",
      version: "1.1.16",
    });
    expect(fixture.items[0]).toMatchObject({
      _microfeed: {is_audio: true},
      id: "audio-field-recording",
    });
    expect(fixture.items.map((item: {_microfeed?: Record<string, boolean>}) =>
      item._microfeed
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({is_video: true}),
      expect.objectContaining({is_image: true}),
      expect.objectContaining({is_document: true}),
      expect.objectContaining({is_external_url: true}),
    ]));
    expect(fixture).toMatchObject({
      _microfeed: {
        items_next_cursor: expect.any(String),
        subscribe_methods: expect.any(Array),
      },
      authors: expect.any(Array),
      navigation_pages: expect.any(Array),
      page: {id: "page-about"},
      search: {results: expect.any(Array)},
    });
    for (const method of fixture._microfeed.subscribe_methods) {
      expect(method.image).toMatch(/^data:image\/svg\+xml,/u);
    }
    const remoteMediaUrls = [
      fixture.icon,
      ...fixture.items.flatMap((item: {
        attachments?: {mime_type?: string; url: string}[];
        image?: string;
      }) => [
        item.image,
        ...(item.attachments ?? [])
          .filter(({mime_type}) => /^(?:audio|image|video)\//u.test(mime_type ?? ""))
          .map(({url}) => url),
      ]),
    ].filter((url): url is string => typeof url === "string");
    expect(remoteMediaUrls).not.toHaveLength(0);
    for (const url of remoteMediaUrls) {
      expect(url).toMatch(/^https:\/\/upload\.wikimedia\.org\//u);
      expect(url).not.toContain("example.test");
    }
    expect(application.version).toBe("1.0.5");
  });

  it("renders subscription methods without broken or duplicated image text", async () => {
    const [feed, item, styles] = await Promise.all([
      readFile(path.join(root, "themes/default/src/templates/web-feed.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/src/templates/web-item.mustache"), "utf8"),
      readFile(path.join(root, "themes/default/src/theme.css"), "utf8"),
    ]);
    for (const template of [feed, item]) {
      expect(template).toContain("{{#image}}");
      expect(template).toContain('alt=""');
      expect(template).toContain('aria-label="{{name}}"');
      expect(template).toContain("flex-none text-sm{{#image}} ml-1 hide-mobile{{/image}}");
      expect(template).not.toContain('alt="{{name}}"');
    }
    expect(styles).toMatch(/\.img-sm\s*\{[\s\S]*?width:\s*1em;[\s\S]*?height:\s*1em;/u);
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
  });
});
