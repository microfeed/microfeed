const {createMigratedInMemoryDatabase} = require("../test-utils/d1-substitute");
import ContentService from "../edge-src/models/ContentService";
import ItemRepo from "../edge-src/models/ItemRepo";

import {onRequestGet as getSitemap} from "./sitemap.xml.jsx";

function makeEnv(db) {
  return {FEED_DB: db};
}

function makeContentService(db) {
  const itemRepo = new ItemRepo(db);
  return {
    itemRepo,
    service: new ContentService({}, {itemRepo}, {url: "https://site.test/"}),
  };
}

describe("GET /sitemap.xml (PRD_SEO_GEO Phase 3)", () => {
  test("emits new-scheme URLs for published items, listing roots, and excludes noindex/unlisted", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {service} = makeContentService(db);

      await service.create("blog_article", {
        status: "published",
        title: "Visible Article",
        content_html: "<p>Body</p>",
        image: "https://cdn.example.com/blog-cover.png",
      });
      await service.create("blog_article", {
        status: "published",
        title: "Noindex Article",
        content_html: "<p>Body</p>",
        noindex: true,
      });
      await service.create("blog_article", {
        status: "unlisted",
        title: "Unlisted Article",
        content_html: "<p>Body</p>",
      });
      await service.create("blog_article", {
        status: "unpublished",
        title: "Unpublished Article",
        content_html: "<p>Body</p>",
      });

      const request = new Request("https://site.test/sitemap.xml");
      const response = await getSitemap({params: {}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("xml");

      const xml = await response.text();

      // Well-formed sitemap envelope.
      expect(xml).toContain("<?xml");
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
      expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
      expect(xml).toContain("</urlset>");

      // Home + listing roots that have content.
      expect(xml).toContain("<loc>https://site.test/</loc>");
      expect(xml).toContain("<loc>https://site.test/blog/</loc>");

      // Published, indexable item uses the NEW url scheme with trailing slash,
      // has a lastmod, and an image sitemap entry.
      expect(xml).toContain("<loc>https://site.test/blog/visible-article/</loc>");
      expect(xml).toMatch(/<loc>https:\/\/site\.test\/blog\/visible-article\/<\/loc>[\s\S]*?<lastmod>/);
      expect(xml).toContain("<image:image><image:loc>https://site.test/blog-cover.png</image:loc></image:image>");

      // Old scheme must never appear.
      expect(xml).not.toContain("web_url");

      // Excluded: noindex, unlisted, unpublished.
      expect(xml).not.toContain("noindex-article");
      expect(xml).not.toContain("unlisted-article");
      expect(xml).not.toContain("unpublished-article");
    } finally {
      db.close();
    }
  });

  test("does not include listing roots with no published content", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const request = new Request("https://site.test/sitemap.xml");
      const response = await getSitemap({params: {}, env: makeEnv(db), request});
      const xml = await response.text();

      expect(xml).toContain("<loc>https://site.test/</loc>");
      expect(xml).not.toContain("https://site.test/blog/</loc>");
      expect(xml).not.toContain("https://site.test/photo/</loc>");
      expect(xml).not.toContain("https://site.test/i/</loc>");
      expect(xml).not.toContain("https://site.test/gallery/</loc>");
    } finally {
      db.close();
    }
  });
});
