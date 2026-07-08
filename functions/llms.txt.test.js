const {createMigratedInMemoryDatabase} = require("../test-utils/d1-substitute");
import ContentService from "../edge-src/models/ContentService";
import ItemRepo from "../edge-src/models/ItemRepo";

import {onRequestGet as getLlmsTxt} from "./llms.txt.jsx";

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

describe("GET /llms.txt (PRD_SEO_GEO Phase 3)", () => {
  test("lists a published blog item with its meta description under a Blog section, excludes noindex", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {service} = makeContentService(db);

      await service.create("blog_article", {
        status: "published",
        title: "Visible Article",
        excerpt: "A short teaser for the article.",
        content_html: "<p>Body</p>",
      });
      await service.create("blog_article", {
        status: "published",
        title: "Noindex Article",
        excerpt: "Should not appear.",
        content_html: "<p>Body</p>",
        noindex: true,
      });
      await service.create("blog_article", {
        status: "unlisted",
        title: "Unlisted Article",
        excerpt: "Should not appear either.",
        content_html: "<p>Body</p>",
      });

      const request = new Request("https://site.test/llms.txt");
      const response = await getLlmsTxt({params: {}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/plain");

      const body = await response.text();

      expect(body).toContain("Site: https://site.test/");
      expect(body).toContain("## Blog");
      expect(body).toContain("- [Visible Article](https://site.test/blog/visible-article/): A short teaser for the article.");

      expect(body).not.toContain("Noindex Article");
      expect(body).not.toContain("Unlisted Article");
    } finally {
      db.close();
    }
  });

  test("omits sections with no published items and includes header with site name/description", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const request = new Request("https://site.test/llms.txt");
      const response = await getLlmsTxt({params: {}, env: makeEnv(db), request});
      const body = await response.text();

      expect(body.startsWith("#")).toBe(true);
      expect(body).not.toContain("## Blog");
      expect(body).not.toContain("## Podcast");
      expect(body).not.toContain("## Photos");
      expect(body).not.toContain("## Galleries");
      expect(body).not.toContain("## Pages");
    } finally {
      db.close();
    }
  });
});
