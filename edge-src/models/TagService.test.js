import TagService from "./TagService";
import TagRepo from "./TagRepo";
import ContentService from "./ContentService";
import ItemRepo from "./ItemRepo";

const {createMigratedInMemoryDatabase} = require("../../test-utils/d1-substitute");

function makeService(db) {
  const tagRepo = new TagRepo(db);
  return {
    tagRepo,
    service: new TagService(db),
  };
}

describe("TagService", () => {
  test("create with a name generates a slug and persists a tag", async () => {
    const db = createMigratedInMemoryDatabase();
    const {service} = makeService(db);

    try {
      const result = await service.create({name: "Breaking News"});

      expect(result).not.toHaveProperty("errors");
      expect(result).toMatchObject({
        name: "Breaking News",
        slug: "breaking-news",
      });
      expect(result.id).toBeTruthy();
    } finally {
      db.close();
    }
  });

  test("create with a duplicate slug (same name twice) returns a slug error and writes only one row", async () => {
    const db = createMigratedInMemoryDatabase();
    const {service, tagRepo} = makeService(db);

    try {
      const first = await service.create({name: "Launch"});
      expect(first).not.toHaveProperty("errors");

      const second = await service.create({name: "Launch"});
      expect(second).toEqual({
        errors: [
          expect.objectContaining({field: "slug"}),
        ],
      });

      const rows = await tagRepo.list();
      expect(rows.results).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  test("create without a name returns a name error and writes nothing", async () => {
    const db = createMigratedInMemoryDatabase();
    const {service, tagRepo} = makeService(db);

    try {
      const result = await service.create({});

      expect(result).toEqual({
        errors: [
          expect.objectContaining({field: "name"}),
        ],
      });

      const rows = await tagRepo.list();
      expect(rows.results).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  test("rename changes the name and slug, and enforces uniqueness against other tags", async () => {
    const db = createMigratedInMemoryDatabase();
    const {service} = makeService(db);

    try {
      const tagA = await service.create({name: "Alpha"});
      const tagB = await service.create({name: "Beta"});

      const renamed = await service.rename(tagA.id, {name: "Alpha Updated"});
      expect(renamed).not.toHaveProperty("errors");
      expect(renamed).toMatchObject({
        id: tagA.id,
        name: "Alpha Updated",
        slug: "alpha-updated",
      });

      const conflict = await service.rename(tagB.id, {slug: "alpha-updated"});
      expect(conflict).toEqual({
        errors: [
          expect.objectContaining({field: "slug"}),
        ],
      });

      const notFound = await service.rename("nonexistent-id", {name: "Nope"});
      expect(notFound).toEqual({
        errors: [
          expect.objectContaining({field: "id"}),
        ],
      });
    } finally {
      db.close();
    }
  });

  test("list returns tags ordered by name", async () => {
    const db = createMigratedInMemoryDatabase();
    const {service} = makeService(db);

    try {
      await service.create({name: "Zebra"});
      await service.create({name: "Apple"});
      await service.create({name: "Mango"});

      const tags = await service.list();
      expect(tags.map((tag) => tag.name)).toEqual(["Apple", "Mango", "Zebra"]);
    } finally {
      db.close();
    }
  });

  test("delete removes the tag and cascades removal of its item_tags rows", async () => {
    const db = createMigratedInMemoryDatabase();
    const {service, tagRepo} = makeService(db);

    try {
      const itemRepo = new ItemRepo(db);
      const contentService = new ContentService({}, {itemRepo}, {url: "https://example.com/"});
      const createResult = await contentService.create("blog_article", {
        status: "published",
        title: "Some Post",
        content_html: "<p>Body</p>",
        excerpt: "Teaser",
        author: "Author",
      });
      expect(createResult).not.toHaveProperty("errors");
      const itemId = createResult;

      const tag = await service.create({name: "Cascade Tag"});
      await db.prepare(
        "INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)",
      ).bind(itemId, tag.id).run();

      const linkedBefore = await db.prepare(
        "SELECT * FROM item_tags WHERE tag_id = ?",
      ).bind(tag.id).all();
      expect(linkedBefore.results).toHaveLength(1);

      const deleteResult = await service.delete(tag.id);
      expect(deleteResult).toEqual({id: tag.id});

      const tagAfter = await tagRepo.getById(tag.id);
      expect(tagAfter).toBeNull();

      const linkedAfter = await db.prepare(
        "SELECT * FROM item_tags WHERE tag_id = ?",
      ).bind(tag.id).all();
      expect(linkedAfter.results).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  test("delete returns not-found error for unknown id", async () => {
    const db = createMigratedInMemoryDatabase();
    const {service} = makeService(db);

    try {
      const result = await service.delete("nonexistent-id");
      expect(result).toEqual({
        errors: [
          expect.objectContaining({field: "id"}),
        ],
      });
    } finally {
      db.close();
    }
  });

  test("getBySlug returns the row or null", async () => {
    const db = createMigratedInMemoryDatabase();
    const {service} = makeService(db);

    try {
      await service.create({name: "Findable"});

      const found = await service.getBySlug("findable");
      expect(found).toMatchObject({name: "Findable", slug: "findable"});

      const notFound = await service.getBySlug("does-not-exist");
      expect(notFound).toBeNull();
    } finally {
      db.close();
    }
  });
});
