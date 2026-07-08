const {createMigratedInMemoryDatabase} = require("../../../../test-utils/d1-substitute");
import ContentService from "../../../../edge-src/models/ContentService";
import ItemRepo from "../../../../edge-src/models/ItemRepo";

import {onRequestGet as getAdminItemPage} from "./index.jsx";

function makeEnv(db) {
  return {FEED_DB: db};
}

function makeContentService(db) {
  const itemRepo = new ItemRepo(db);
  return new ContentService({}, {itemRepo}, {url: "https://example.com/"});
}

describe("admin item edit page", () => {
  test("hydrates related_items ids into the editor payload", async () => {
    const db = createMigratedInMemoryDatabase();

    try {
      const itemRepo = new ItemRepo(db);
      const service = makeContentService(db);

      const relatedId = await service.create("blog_article", {
        status: "published",
        title: "Related Article",
        content_html: "<p>Related</p>",
      });
      const sourceId = await service.create("blog_article", {
        status: "published",
        title: "Source Article",
        content_html: "<p>Body</p>",
      });

      await db.prepare(
        "INSERT INTO item_relations (parent_item_id, child_item_id, rel_type, position) VALUES (?, ?, ?, ?)",
      ).bind(sourceId, relatedId, "related_content", 0).run();

      const request = new Request(`https://site.test/admin/items/${sourceId}`, {
        method: "GET",
      });
      const response = await getAdminItemPage({
        env: makeEnv(db),
        params: {itemId: sourceId},
        request,
      });

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Related items");
      expect(html).toContain(relatedId);
      expect(await itemRepo.getById(sourceId)).toBeTruthy();
    } finally {
      db.close();
    }
  });
});
