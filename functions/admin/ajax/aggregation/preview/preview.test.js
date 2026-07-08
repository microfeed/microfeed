const {createMigratedInMemoryDatabase} = require("../../../../../test-utils/d1-substitute");
import ItemRepo from "../../../../../edge-src/models/ItemRepo";
import ContentService from "../../../../../edge-src/models/ContentService";
import TagService from "../../../../../edge-src/models/TagService";

import {onRequestPost as previewFilter} from "./index.jsx";

function makeContentService(db) {
  const itemRepo = new ItemRepo(db);
  return new ContentService({}, {itemRepo}, {url: "https://site.test/"});
}

function jsonRequest(body) {
  return new Request("https://site.test/admin/ajax/aggregation/preview", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body),
  });
}

describe("admin aggregation preview ajax handler", () => {
  test("POST a filter config returns 200 with the matched items, serialized for feed", async () => {
    const db = createMigratedInMemoryDatabase();
    const itemRepo = new ItemRepo(db);
    const contentService = makeContentService(db);
    const tagService = new TagService(db);
    const env = {FEED_DB: db};

    try {
      const tag1 = await tagService.create({name: "featured"});

      await contentService.create("blog_article", {
        status: "published",
        title: "Tagged Blog",
        content_html: "<p>Tagged</p>",
        tags: [tag1.id],
      });
      await contentService.create("blog_article", {
        status: "published",
        title: "Untagged Blog",
        content_html: "<p>Untagged</p>",
      });
      await contentService.create("photo", {
        status: "published",
        title: "Tagged Photo",
        image: "https://cdn.example.com/images/tagged-photo.png",
        tags: [tag1.id],
      });

      const response = await previewFilter({
        request: jsonRequest({
          content_types: ["blog_article"],
          filter_tags: [tag1.id],
        }),
        env,
        params: {},
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({
        content_type: "blog_article",
        slug: "tagged-blog",
      });
      void itemRepo;
    } finally {
      db.close();
    }
  });

  test("POST with no matches returns 200 with an empty items array", async () => {
    const db = createMigratedInMemoryDatabase();
    const contentService = makeContentService(db);
    const env = {FEED_DB: db};

    try {
      await contentService.create("blog_article", {
        status: "published",
        title: "Some Blog",
        content_html: "<p>Some</p>",
      });

      const response = await previewFilter({
        request: jsonRequest({
          content_types: ["photo"],
        }),
        env,
        params: {},
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.items).toEqual([]);
    } finally {
      db.close();
    }
  });

  test("POST includes unlisted items in preview matches", async () => {
    const db = createMigratedInMemoryDatabase();
    const itemRepo = new ItemRepo(db);
    const contentService = makeContentService(db);
    const env = {FEED_DB: db};

    try {
      await contentService.create("blog_article", {
        status: "unlisted",
        title: "Unlisted Blog",
        content_html: "<p>Unlisted</p>",
      });

      const response = await previewFilter({
        request: jsonRequest({content_types: ["blog_article"]}),
        env,
        params: {},
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].slug).toBe("unlisted-blog");
      void itemRepo;
    } finally {
      db.close();
    }
  });
});
