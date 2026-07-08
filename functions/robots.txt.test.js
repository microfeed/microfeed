const {createMigratedInMemoryDatabase} = require("../test-utils/d1-substitute");

import {onRequestGet as getRobotsTxt} from "./robots.txt.jsx";

function makeEnv(db) {
  return {FEED_DB: db};
}

describe("GET /robots.txt (PRD_SEO_GEO Phase 3)", () => {
  test("returns 200 text/plain with Disallow /admin and the origin's Sitemap line", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const request = new Request("https://site.test/robots.txt");
      const response = await getRobotsTxt({params: {}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/plain");

      const body = await response.text();
      expect(body).toContain("User-agent: *");
      expect(body).toContain("Allow: /");
      expect(body).toContain("Disallow: /admin");
      expect(body).toContain("Disallow: /api");
      expect(body).toContain("Sitemap: https://site.test/sitemap.xml");
    } finally {
      db.close();
    }
  });
});
