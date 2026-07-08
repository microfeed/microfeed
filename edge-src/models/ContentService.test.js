import ContentService from "./ContentService";
import ItemRepo from "./ItemRepo";
import TagLinkRepo from "./TagLinkRepo";
import RelationRepo, {GALLERY_MEMBER, RELATED_CONTENT} from "./RelationRepo";
import TagService from "./TagService";
import {STATUSES} from "../../common-src/Constants";

const {createMigratedInMemoryDatabase} = require("../../test-utils/d1-substitute");

function makeService(db) {
  const itemRepo = new ItemRepo(db);
  return {
    itemRepo,
    tagLinkRepo: new TagLinkRepo(db),
    relationRepo: new RelationRepo(db),
    service: new ContentService({}, {itemRepo}, {url: "https://example.com/"}),
  };
}

async function createPhoto(service, itemRepo, title) {
  await service.create("photo", {
    status: "published",
    title,
    image: `https://cdn.example.com/images/${title}.png`,
  });
  const row = await itemRepo.getByTypeAndSlug("photo", title.toLowerCase().replace(/\s+/g, "-"));
  return row.id;
}

async function createTags(db, names) {
  const tagService = new TagService(db);
  const tags = [];
  for (const name of names) {
    const tag = await tagService.create({name});
    tags.push(tag);
  }
  return tags;
}

function makeServiceWithMediaStore(db) {
  const itemRepo = new ItemRepo(db);
  const mediaStore = {
    deleteObject: jest.fn().mockResolvedValue(undefined),
  };
  return {
    itemRepo,
    mediaStore,
    service: new ContentService({}, {itemRepo}, {url: "https://example.com/"}, mediaStore),
  };
}

describe("ContentService", () => {
  test("create persists typed content with generated slug and mapped internal schema", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, tagLinkRepo, service} = makeService(db);

    try {
      const [newsTag, launchTag] = await createTags(db, ["news", "launch"]);

      await service.create("blog_article", {
        status: "published",
        title: "Hello World",
        content_html: "<p>Body</p>",
        excerpt: "Short teaser",
        author: "Ada Lovelace",
        tags: [newsTag.id, launchTag.id],
        date_published_ms: 1720051200000,
      });

      const row = await itemRepo.getByTypeAndSlug("blog_article", "hello-world");
      expect(row).toMatchObject({
        content_type: "blog_article",
        slug: "hello-world",
        status: STATUSES.PUBLISHED,
        pub_date: "2024-07-04T00:00:00.000Z",
      });
      expect(JSON.parse(row.data)).toEqual({
        title: "Hello World",
        description: "<p>Body</p>",
        excerpt: "Short teaser",
        author: "Ada Lovelace",
      });

      const linkedTagIds = await tagLinkRepo.getTagIdsForItem(row.id);
      expect(linkedTagIds.sort()).toEqual([newsTag.id, launchTag.id].sort());
    } finally {
      db.close();
    }
  });

  test("create returns field errors and writes nothing when validation fails", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, service} = makeService(db);

    try {
      const result = await service.create("blog_article", {
        status: "archived",
        title: "",
        content_html: "",
        tags: ["news", ""],
      });

      expect(result).toEqual({
        errors: expect.arrayContaining([
          expect.objectContaining({field: "status"}),
          expect.objectContaining({field: "title"}),
          expect.objectContaining({field: "content_html"}),
          expect.objectContaining({field: "tags"}),
        ]),
      });
      expect((await itemRepo.list()).results).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  test("update merges with existing content and revalidates the full payload", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, tagLinkRepo, service} = makeService(db);

    try {
      const [oneTag, twoTag] = await createTags(db, ["one", "two"]);

      await service.create("blog_article", {
        status: "published",
        title: "Original Title",
        content_html: "<p>Original body</p>",
        excerpt: "Original teaser",
        author: "Ada",
        tags: [oneTag.id, twoTag.id],
        date_published_ms: 1720051200000,
      });

      const existing = await itemRepo.getByTypeAndSlug("blog_article", "original-title");
      expect(existing).toBeTruthy();

      const result = await service.update(existing.id, {
        excerpt: "Updated teaser",
      });

      expect(result).not.toHaveProperty("errors");
      const updated = await itemRepo.getById(existing.id);
      expect(updated).toMatchObject({
        id: existing.id,
        content_type: "blog_article",
        slug: "original-title",
      });
      expect(JSON.parse(updated.data)).toEqual({
        title: "Original Title",
        description: "<p>Original body</p>",
        excerpt: "Updated teaser",
        author: "Ada",
      });

      const linkedTagIds = await tagLinkRepo.getTagIdsForItem(existing.id);
      expect(linkedTagIds.sort()).toEqual([oneTag.id, twoTag.id].sort());
    } finally {
      db.close();
    }
  });

  test("update replacing tags updates item_tags links to exactly the new set", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, tagLinkRepo, service} = makeService(db);

    try {
      const [tagOne, tagTwo, tagThree] = await createTags(db, ["one", "two", "three"]);

      await service.create("blog_article", {
        status: "published",
        title: "Tag Replace Test",
        content_html: "<p>Body</p>",
        tags: [tagOne.id, tagTwo.id],
      });

      const existing = await itemRepo.getByTypeAndSlug("blog_article", "tag-replace-test");

      const result = await service.update(existing.id, {
        tags: [tagTwo.id, tagThree.id],
      });

      expect(result).not.toHaveProperty("errors");
      const linkedTagIds = await tagLinkRepo.getTagIdsForItem(existing.id);
      expect(linkedTagIds.sort()).toEqual([tagTwo.id, tagThree.id].sort());

      const updatedRow = await itemRepo.getById(existing.id);
      expect(JSON.parse(updatedRow.data)).not.toHaveProperty("tags");
    } finally {
      db.close();
    }
  });

  test("update without a tags field in the patch preserves existing tag links", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, tagLinkRepo, service} = makeService(db);

    try {
      const [tagOne, tagTwo] = await createTags(db, ["one", "two"]);

      await service.create("blog_article", {
        status: "published",
        title: "Tag Preserve Test",
        content_html: "<p>Body</p>",
        tags: [tagOne.id, tagTwo.id],
      });

      const existing = await itemRepo.getByTypeAndSlug("blog_article", "tag-preserve-test");

      const result = await service.update(existing.id, {
        excerpt: "Just a text update, no tags key",
      });

      expect(result).not.toHaveProperty("errors");
      const linkedTagIds = await tagLinkRepo.getTagIdsForItem(existing.id);
      expect(linkedTagIds.sort()).toEqual([tagOne.id, tagTwo.id].sort());
    } finally {
      db.close();
    }
  });

  test("duplicate generated slugs are rejected for the same content type", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, service} = makeService(db);

    try {
      await service.create("blog_article", {
        status: "published",
        title: "Same Title",
        content_html: "<p>One</p>",
      });

      const result = await service.create("blog_article", {
        status: "published",
        title: "Same Title",
        content_html: "<p>Two</p>",
      });

      expect(result).toEqual({
        errors: expect.arrayContaining([
          expect.objectContaining({field: "slug"}),
        ]),
      });
      expect((await itemRepo.list()).results).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  test("create honours an explicit user-defined slug instead of inferring from the title", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, service} = makeService(db);

    try {
      await service.create("blog_article", {
        status: "published",
        title: "My Very Long Title",
        slug: "custom-handle",
        content_html: "<p>Body</p>",
      });

      expect(await itemRepo.getByTypeAndSlug("blog_article", "custom-handle")).toBeTruthy();
      expect(await itemRepo.getByTypeAndSlug("blog_article", "my-very-long-title")).toBeNull();
    } finally {
      db.close();
    }
  });

  test("create normalizes a messy explicit slug to a url-safe form", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, service} = makeService(db);

    try {
      await service.create("blog_article", {
        status: "published",
        title: "Whatever",
        slug: "Hello World! Special/Chars",
        content_html: "<p>Body</p>",
      });

      const rows = (await itemRepo.list()).results;
      expect(rows).toHaveLength(1);
      const {slug} = rows[0];
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(slug.startsWith("hello-world")).toBe(true);
    } finally {
      db.close();
    }
  });

  test("home_page is singleton-locked to the home slug on create and update", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, service} = makeService(db);

    try {
      const createdId = await service.create("home_page", {
        status: "published",
        title: "Welcome Home",
        slug: "custom-slug",
        content_html: "<p>Home</p>",
      });

      const created = await itemRepo.getById(createdId);
      expect(created).toMatchObject({
        id: createdId,
        content_type: "home_page",
        slug: "home",
      });

      const second = await service.create("home_page", {
        status: "published",
        title: "Another Home",
        content_html: "<p>Duplicate</p>",
      });
      expect(second).toEqual({
        errors: expect.arrayContaining([
          expect.objectContaining({field: "content_type"}),
        ]),
      });

      const updateResult = await service.update(createdId, {
        slug: "still-ignored",
        title: "Updated Home",
      });
      expect(updateResult).toEqual(createdId);
      expect((await itemRepo.getById(createdId)).slug).toBe("home");
      expect(JSON.parse((await itemRepo.getById(createdId)).data).title).toBe("Updated Home");
    } finally {
      db.close();
    }
  });

  test("home_page cannot be deleted or purged", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, service} = makeService(db);

    try {
      const createdId = await service.create("home_page", {
        status: "published",
        title: "Welcome Home",
        content_html: "<p>Home</p>",
      });

      const deleteResult = await service.delete(createdId);
      expect(deleteResult).toEqual({
        errors: expect.arrayContaining([
          expect.objectContaining({field: "id", message: "Singleton items cannot be deleted"}),
        ]),
      });

      await service.update(createdId, {status: "published"});
      const purgeResult = await service.purge(createdId, {force: true});
      expect(purgeResult).toEqual({
        errors: expect.arrayContaining([
          expect.objectContaining({field: "id", message: "Singleton items cannot be purged"}),
        ]),
      });

      expect(await itemRepo.getById(createdId)).toBeTruthy();
    } finally {
      db.close();
    }
  });

  test("update preserves the existing slug when the title changes and no slug is given", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, service} = makeService(db);

    try {
      await service.create("blog_article", {
        status: "published",
        title: "First Title",
        content_html: "<p>Body</p>",
      });
      const existing = await itemRepo.getByTypeAndSlug("blog_article", "first-title");

      await service.update(existing.id, {title: "A Completely New Title"});

      const updated = await itemRepo.getById(existing.id);
      expect(updated.slug).toBe("first-title");
      expect(JSON.parse(updated.data).title).toBe("A Completely New Title");
    } finally {
      db.close();
    }
  });

  test("update changes the slug when an explicit slug is provided", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, service} = makeService(db);

    try {
      await service.create("blog_article", {
        status: "published",
        title: "First Title",
        content_html: "<p>Body</p>",
      });
      const existing = await itemRepo.getByTypeAndSlug("blog_article", "first-title");

      await service.update(existing.id, {slug: "brand-new-slug"});

      const updated = await itemRepo.getById(existing.id);
      expect(updated.slug).toBe("brand-new-slug");
    } finally {
      db.close();
    }
  });

  test("update rejects an explicit slug that collides with another item of the same type", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, service} = makeService(db);

    try {
      await service.create("blog_article", {status: "published", title: "Post One", content_html: "<p>1</p>"});
      await service.create("blog_article", {status: "published", title: "Post Two", content_html: "<p>2</p>"});
      const two = await itemRepo.getByTypeAndSlug("blog_article", "post-two");

      const result = await service.update(two.id, {slug: "post-one"});

      expect(result).toEqual({
        errors: expect.arrayContaining([expect.objectContaining({field: "slug"})]),
      });
      // Unchanged.
      expect((await itemRepo.getById(two.id)).slug).toBe("post-two");
    } finally {
      db.close();
    }
  });

  test("delete soft-deletes an item, keeping it retrievable but excluded from active listings", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, service} = makeService(db);

    try {
      await service.create("blog_article", {
        status: "published",
        title: "To Be Deleted",
        content_html: "<p>Body</p>",
      });
      const existing = await itemRepo.getByTypeAndSlug("blog_article", "to-be-deleted");

      const result = await service.delete(existing.id);

      expect(result).toEqual(existing.id);
      const row = await itemRepo.getById(existing.id);
      expect(row).toMatchObject({
        id: existing.id,
        status: STATUSES.DELETED,
      });
      const activeResults = await itemRepo.list({
        queryKwargs: {
          "status__!=": STATUSES.DELETED,
        },
      });
      expect(activeResults.results.map((entry) => entry.id)).not.toContain(existing.id);
    } finally {
      db.close();
    }
  });

  test("delete on a missing id returns not-found error and writes nothing", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, service} = makeService(db);

    try {
      const result = await service.delete("does-not-exist");

      expect(result).toEqual({
        errors: expect.arrayContaining([
          expect.objectContaining({field: "id", message: "Item not found"}),
        ]),
      });
      expect((await itemRepo.list()).results).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  test("restore sets a soft-deleted item's status to unpublished", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, service} = makeService(db);

    try {
      await service.create("blog_article", {
        status: "published",
        title: "To Be Restored",
        content_html: "<p>Body</p>",
      });
      const existing = await itemRepo.getByTypeAndSlug("blog_article", "to-be-restored");
      await service.delete(existing.id);

      const result = await service.restore(existing.id);

      expect(result).toEqual(existing.id);
      const row = await itemRepo.getById(existing.id);
      expect(row).toMatchObject({
        id: existing.id,
        status: STATUSES.UNPUBLISHED,
      });
    } finally {
      db.close();
    }
  });

  test("restore on a non-deleted item returns a not-deleted error and does not change status", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, service} = makeService(db);

    try {
      await service.create("blog_article", {
        status: "published",
        title: "Still Live",
        content_html: "<p>Body</p>",
      });
      const existing = await itemRepo.getByTypeAndSlug("blog_article", "still-live");

      const result = await service.restore(existing.id);

      expect(result).toEqual({
        errors: expect.arrayContaining([
          expect.objectContaining({field: "id", message: "Item is not deleted"}),
        ]),
      });
      const row = await itemRepo.getById(existing.id);
      expect(row).toMatchObject({
        id: existing.id,
        status: STATUSES.PUBLISHED,
      });
    } finally {
      db.close();
    }
  });

  test("restore on a missing id returns not-found error", async () => {
    const db = createMigratedInMemoryDatabase();
    const {service} = makeService(db);

    try {
      const result = await service.restore("does-not-exist");

      expect(result).toEqual({
        errors: expect.arrayContaining([
          expect.objectContaining({field: "id", message: "Item not found"}),
        ]),
      });
    } finally {
      db.close();
    }
  });

  describe("purge", () => {
    test("purges a soft-deleted podcast item, deleting its media and link rows", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, service, mediaStore} = makeServiceWithMediaStore(db);

      try {
        await service.create("podcast_episode", {
          status: "published",
          title: "Episode One",
          content_html: "<p>Body</p>",
          image: "https://cdn.example.com/images/cover-1.png",
          attachment: {
            category: "audio",
            url: "https://cdn.example.com/media/audio-1.mp3",
          },
        });
        const existing = await itemRepo.getByTypeAndSlug("podcast_episode", "episode-one");
        expect(existing).toBeTruthy();

        // Seed link rows directly to prove purge cleans them up.
        const tagRow = {id: "tag00000001", slug: "news", name: "News"};
        db.prepare(
          "INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)",
        ).bind(tagRow.id, tagRow.slug, tagRow.name).run();
        await db.prepare(
          "INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)",
        ).bind(existing.id, tagRow.id).run();

        const otherItemId = await service.create("podcast_episode", {
          status: "published",
          title: "Episode Two",
          content_html: "<p>Other</p>",
        });
        await db.prepare(
          "INSERT INTO item_relations (parent_item_id, child_item_id, rel_type, position) VALUES (?, ?, ?, ?)",
        ).bind(existing.id, otherItemId, "gallery_member", 0).run();

        await service.delete(existing.id);

        const result = await service.purge(existing.id);

        expect(result).toEqual(existing.id);
        expect(await itemRepo.getById(existing.id)).toBeNull();

        expect(mediaStore.deleteObject).toHaveBeenCalledTimes(2);
        const calledKeys = mediaStore.deleteObject.mock.calls.map((call) => call[0]);
        expect(calledKeys).toEqual(expect.arrayContaining([
          "images/cover-1.png",
          "media/audio-1.mp3",
        ]));

        const remainingItemTags = await db.prepare(
          "SELECT * FROM item_tags WHERE item_id = ?",
        ).bind(existing.id).all();
        expect(remainingItemTags.results).toHaveLength(0);

        const remainingRelations = await db.prepare(
          "SELECT * FROM item_relations WHERE parent_item_id = ? OR child_item_id = ?",
        ).bind(existing.id, existing.id).all();
        expect(remainingRelations.results).toHaveLength(0);
      } finally {
        db.close();
      }
    });

    test("purges a soft-deleted photo item, deleting its image", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, service, mediaStore} = makeServiceWithMediaStore(db);

      try {
        await service.create("photo", {
          status: "published",
          title: "A Photo",
          image: "https://cdn.example.com/images/photo-1.png",
        });
        const existing = await itemRepo.getByTypeAndSlug("photo", "a-photo");
        await service.delete(existing.id);

        const result = await service.purge(existing.id);

        expect(result).toEqual(existing.id);
        expect(await itemRepo.getById(existing.id)).toBeNull();
        expect(mediaStore.deleteObject).toHaveBeenCalledTimes(1);
        expect(mediaStore.deleteObject).toHaveBeenCalledWith("images/photo-1.png");
      } finally {
        db.close();
      }
    });

    test("purge on a live item without force returns an error and changes nothing", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, service, mediaStore} = makeServiceWithMediaStore(db);

      try {
        await service.create("blog_article", {
          status: "published",
          title: "Still Live",
          content_html: "<p>Body</p>",
        });
        const existing = await itemRepo.getByTypeAndSlug("blog_article", "still-live");

        const result = await service.purge(existing.id);

        expect(result).toEqual({
          errors: expect.arrayContaining([
            expect.objectContaining({field: "id", message: "Item must be soft-deleted before purge"}),
          ]),
        });
        expect(await itemRepo.getById(existing.id)).toMatchObject({
          id: existing.id,
          status: STATUSES.PUBLISHED,
        });
        expect(mediaStore.deleteObject).not.toHaveBeenCalled();
      } finally {
        db.close();
      }
    });

    test("purge on a live item with force:true removes it", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, service} = makeServiceWithMediaStore(db);

      try {
        await service.create("blog_article", {
          status: "published",
          title: "Force Purge Me",
          content_html: "<p>Body</p>",
        });
        const existing = await itemRepo.getByTypeAndSlug("blog_article", "force-purge-me");

        const result = await service.purge(existing.id, {force: true});

        expect(result).toEqual(existing.id);
        expect(await itemRepo.getById(existing.id)).toBeNull();
      } finally {
        db.close();
      }
    });

    test("purge on a missing id returns a not-found error", async () => {
      const db = createMigratedInMemoryDatabase();
      const {service, mediaStore} = makeServiceWithMediaStore(db);

      try {
        const result = await service.purge("does-not-exist");

        expect(result).toEqual({
          errors: expect.arrayContaining([
            expect.objectContaining({field: "id", message: "Item not found"}),
          ]),
        });
        expect(mediaStore.deleteObject).not.toHaveBeenCalled();
      } finally {
        db.close();
      }
    });
  });

  describe("bulk operations", () => {
    async function createTwoItems(service) {
      const idA = await service.create("blog_article", {
        status: "published",
        title: "Bulk Item A",
        content_html: "<p>A</p>",
      });
      const idB = await service.create("blog_article", {
        status: "published",
        title: "Bulk Item B",
        content_html: "<p>B</p>",
      });
      return [idA, idB];
    }

    test("bulkPublish sets status=PUBLISHED for existing ids and skips unknown ids", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, service} = makeService(db);

      try {
        const [idA, idB] = await createTwoItems(service);
        await service.bulkUnpublish([idA, idB]);

        const result = await service.bulkPublish([idA, idB, "missing"]);

        expect(result.succeeded.slice().sort()).toEqual([idA, idB].sort());
        expect(result.skipped).toEqual([{id: "missing", reason: "not found"}]);

        const rowA = await itemRepo.getById(idA);
        const rowB = await itemRepo.getById(idB);
        expect(rowA.status).toEqual(STATUSES.PUBLISHED);
        expect(rowB.status).toEqual(STATUSES.PUBLISHED);
      } finally {
        db.close();
      }
    });

    test("bulkUnpublish sets status=UNPUBLISHED for existing ids and skips unknown ids", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, service} = makeService(db);

      try {
        const [idA, idB] = await createTwoItems(service);

        const result = await service.bulkUnpublish([idA, idB, "missing"]);

        expect(result.succeeded.slice().sort()).toEqual([idA, idB].sort());
        expect(result.skipped).toEqual([{id: "missing", reason: "not found"}]);

        const rowA = await itemRepo.getById(idA);
        const rowB = await itemRepo.getById(idB);
        expect(rowA.status).toEqual(STATUSES.UNPUBLISHED);
        expect(rowB.status).toEqual(STATUSES.UNPUBLISHED);
      } finally {
        db.close();
      }
    });

    test("bulkDelete soft-deletes existing ids and skips unknown ids", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, service} = makeService(db);

      try {
        const [idA, idB] = await createTwoItems(service);

        const result = await service.bulkDelete([idA, idB, "missing"]);

        expect(result.succeeded.slice().sort()).toEqual([idA, idB].sort());
        expect(result.skipped).toEqual([{id: "missing", reason: "not found"}]);

        const rowA = await itemRepo.getById(idA);
        const rowB = await itemRepo.getById(idB);
        expect(rowA.status).toEqual(STATUSES.DELETED);
        expect(rowB.status).toEqual(STATUSES.DELETED);
      } finally {
        db.close();
      }
    });

    async function seedTags(db, tagIds) {
      for (const tagId of tagIds) {
        await db.prepare(
          "INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)",
        ).bind(tagId, tagId, tagId).run();
      }
    }

    test("bulkTag inserts item_tags rows for existing ids, skips unknown ids, and is idempotent", async () => {
      const db = createMigratedInMemoryDatabase();
      const {service} = makeService(db);

      try {
        const [idA] = await createTwoItems(service);
        await seedTags(db, ["tag_1", "tag_2"]);

        const result = await service.bulkTag([idA, "missing"], ["tag_1", "tag_2"]);

        expect(result.succeeded).toEqual([idA]);
        expect(result.skipped).toEqual([{id: "missing", reason: "not found"}]);

        const rows = await db.prepare(
          "SELECT * FROM item_tags WHERE item_id = ?",
        ).bind(idA).all();
        expect(rows.results).toHaveLength(2);
        expect(rows.results.map((row) => row.tag_id).sort()).toEqual(["tag_1", "tag_2"]);

        // Calling again is idempotent: no duplicate rows, no error.
        const secondResult = await service.bulkTag([idA, "missing"], ["tag_1", "tag_2"]);
        expect(secondResult.succeeded).toEqual([idA]);
        expect(secondResult.skipped).toEqual([{id: "missing", reason: "not found"}]);

        const rowsAfter = await db.prepare(
          "SELECT * FROM item_tags WHERE item_id = ?",
        ).bind(idA).all();
        expect(rowsAfter.results).toHaveLength(2);
      } finally {
        db.close();
      }
    });

    test("bulkTag with empty tagIds reports success with no inserted rows", async () => {
      const db = createMigratedInMemoryDatabase();
      const {service} = makeService(db);

      try {
        const [idA] = await createTwoItems(service);

        const result = await service.bulkTag([idA], []);

        expect(result.succeeded).toEqual([idA]);
        expect(result.skipped).toEqual([]);

        const rows = await db.prepare(
          "SELECT * FROM item_tags WHERE item_id = ?",
        ).bind(idA).all();
        expect(rows.results).toHaveLength(0);
      } finally {
        db.close();
      }
    });

    test("bulk operations return empty succeeded/skipped for empty ids", async () => {
      const db = createMigratedInMemoryDatabase();
      const {service} = makeService(db);

      try {
        expect(await service.bulkPublish([])).toEqual({succeeded: [], skipped: []});
        expect(await service.bulkUnpublish([])).toEqual({succeeded: [], skipped: []});
        expect(await service.bulkDelete([])).toEqual({succeeded: [], skipped: []});
        expect(await service.bulkTag([], ["tag_1"])).toEqual({succeeded: [], skipped: []});
      } finally {
        db.close();
      }
    });
  });

  describe("reference field / gallery membership", () => {
    test("create with members writes ordered item_relations rows and keeps members out of the data blob", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, relationRepo, service} = makeService(db);

      try {
        const photo1 = await createPhoto(service, itemRepo, "Photo One");
        const photo2 = await createPhoto(service, itemRepo, "Photo Two");

        const galleryId = await service.create("gallery", {
          status: "published",
          title: "My Gallery",
          members: [photo1, photo2],
        });

        expect(typeof galleryId).toBe("string");

        const memberIds = await relationRepo.getMemberIds(galleryId, GALLERY_MEMBER);
        expect(memberIds).toEqual([photo1, photo2]);

        const rows = await db.prepare(
          "SELECT * FROM item_relations WHERE parent_item_id = ?",
        ).bind(galleryId).all();
        expect(rows.results).toHaveLength(2);

        const galleryRow = await itemRepo.getById(galleryId);
        expect(JSON.parse(galleryRow.data)).not.toHaveProperty("members");
      } finally {
        db.close();
      }
    });

    test("create rejects a member id that is not a photo and writes nothing", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, service} = makeService(db);

      try {
        const blogId = await service.create("blog_article", {
          status: "published",
          title: "Not A Photo",
          content_html: "<p>Body</p>",
        });

        const result = await service.create("gallery", {
          status: "published",
          title: "Bad Gallery",
          members: [blogId],
        });

        expect(result).toEqual({
          errors: expect.arrayContaining([
            expect.objectContaining({field: "members"}),
          ]),
        });

        const galleries = await itemRepo.list({queryKwargs: {content_type: "gallery"}});
        expect(galleries.results).toHaveLength(0);
      } finally {
        db.close();
      }
    });

    test("create rejects a non-existent member id and writes nothing", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, service} = makeService(db);

      try {
        const result = await service.create("gallery", {
          status: "published",
          title: "Ghost Member Gallery",
          members: ["does-not-exist"],
        });

        expect(result).toEqual({
          errors: expect.arrayContaining([
            expect.objectContaining({field: "members"}),
          ]),
        });

        const galleries = await itemRepo.list({queryKwargs: {content_type: "gallery"}});
        expect(galleries.results).toHaveLength(0);
      } finally {
        db.close();
      }
    });

    test("update reorders members via clear+reinsert without a unique-constraint error", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, relationRepo, service} = makeService(db);

      try {
        const photo1 = await createPhoto(service, itemRepo, "Photo One");
        const photo2 = await createPhoto(service, itemRepo, "Photo Two");
        const photo3 = await createPhoto(service, itemRepo, "Photo Three");

        const galleryId = await service.create("gallery", {
          status: "published",
          title: "Reorder Gallery",
          members: [photo1, photo2, photo3],
        });

        const result = await service.update(galleryId, {
          members: [photo3, photo1, photo2],
        });

        expect(result).not.toHaveProperty("errors");
        expect(await relationRepo.getMemberIds(galleryId, GALLERY_MEMBER)).toEqual([
          photo3,
          photo1,
          photo2,
        ]);
      } finally {
        db.close();
      }
    });

    test("update without a members key preserves existing members", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, relationRepo, service} = makeService(db);

      try {
        const photo1 = await createPhoto(service, itemRepo, "Photo One");
        const photo2 = await createPhoto(service, itemRepo, "Photo Two");

        const galleryId = await service.create("gallery", {
          status: "published",
          title: "Preserve Gallery",
          members: [photo1, photo2],
        });

        const result = await service.update(galleryId, {
          content_html: "<p>Updated description</p>",
        });

        expect(result).not.toHaveProperty("errors");
        expect(await relationRepo.getMemberIds(galleryId, GALLERY_MEMBER)).toEqual([
          photo1,
          photo2,
        ]);
      } finally {
        db.close();
      }
    });

    test("update rejects a member id that is not a photo and changes nothing", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, relationRepo, service} = makeService(db);

      try {
        const photo1 = await createPhoto(service, itemRepo, "Photo One");
        const blogId = await service.create("blog_article", {
          status: "published",
          title: "Not A Photo Either",
          content_html: "<p>Body</p>",
        });

        const galleryId = await service.create("gallery", {
          status: "published",
          title: "Guarded Gallery",
          members: [photo1],
        });

        const result = await service.update(galleryId, {
          members: [photo1, blogId],
        });

        expect(result).toEqual({
          errors: expect.arrayContaining([
            expect.objectContaining({field: "members"}),
          ]),
        });

        expect(await relationRepo.getMemberIds(galleryId, GALLERY_MEMBER)).toEqual([photo1]);
        const galleryRow = await itemRepo.getById(galleryId);
        expect(JSON.parse(galleryRow.data)).not.toHaveProperty("members");
      } finally {
        db.close();
      }
    });
  });

  describe("related-content relations", () => {
    async function createRelatedItem(service, itemRepo, typeName, title, extra = {}) {
      await service.create(typeName, {
        status: "published",
        title,
        ...extra,
      });
      return itemRepo.getByTypeAndSlug(typeName, title.toLowerCase().replace(/\s+/g, "-"));
    }

    test("create and update keep gallery membership separate from related-content relations", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, relationRepo, service} = makeService(db);

      try {
        const photoOne = await createPhoto(service, itemRepo, "Photo One");
        const photoTwo = await createPhoto(service, itemRepo, "Photo Two");
        const relatedBlogOne = await createRelatedItem(service, itemRepo, "blog_article", "Related Blog One", {
          content_html: "<p>Related one</p>",
        });
        const relatedBlogTwo = await createRelatedItem(service, itemRepo, "blog_article", "Related Blog Two", {
          content_html: "<p>Related two</p>",
        });

        const galleryId = await service.create("gallery", {
          status: "published",
          title: "Related Gallery",
          members: [photoOne, photoTwo],
          related_items: [relatedBlogOne.id, relatedBlogTwo.id],
        });

        const galleryRow = await itemRepo.getById(galleryId);
        expect(JSON.parse(galleryRow.data)).not.toHaveProperty("members");
        expect(JSON.parse(galleryRow.data)).not.toHaveProperty("related_items");
        expect(await relationRepo.getMemberIds(galleryId, GALLERY_MEMBER)).toEqual([
          photoOne,
          photoTwo,
        ]);
        expect((await relationRepo.getRelatedItemIds(galleryId)).sort()).toEqual([
          relatedBlogOne.id,
          relatedBlogTwo.id,
        ].sort());

        const relatedBlogThree = await createRelatedItem(service, itemRepo, "blog_article", "Related Blog Three", {
          content_html: "<p>Related three</p>",
        });
        const updateResult = await service.update(galleryId, {
          related_items: [relatedBlogThree.id],
        });

        expect(updateResult).not.toHaveProperty("errors");
        expect(await relationRepo.getMemberIds(galleryId, GALLERY_MEMBER)).toEqual([
          photoOne,
          photoTwo,
        ]);
        expect(await relationRepo.getMemberIds(galleryId, RELATED_CONTENT)).toEqual([
          relatedBlogThree.id,
        ]);
      } finally {
        db.close();
      }
    });

    test("create rejects unpublished or home_page related items and writes nothing", async () => {
      const db = createMigratedInMemoryDatabase();
      const {itemRepo, service} = makeService(db);

      try {
        const homeId = await service.create("home_page", {
          status: "published",
          title: "Home",
        });
        const unpublishedBlog = await service.create("blog_article", {
          status: "unpublished",
          title: "Hidden Blog",
          content_html: "<p>Hidden</p>",
        });

        const result = await service.create("blog_article", {
          status: "published",
          title: "Related Host",
          content_html: "<p>Body</p>",
          related_items: [homeId, unpublishedBlog],
        });

        expect(result).toEqual({
          errors: expect.arrayContaining([
            expect.objectContaining({field: "related_items"}),
          ]),
        });
        expect((await itemRepo.list()).results).toHaveLength(2);
      } finally {
        db.close();
      }
    });
  });
});
