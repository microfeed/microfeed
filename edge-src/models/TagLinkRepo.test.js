import TagLinkRepo from "./TagLinkRepo";

const {createMigratedInMemoryDatabase} = require("../../test-utils/d1-substitute");

async function seedItem(db, id) {
  await db.prepare(
    "INSERT INTO items (id, status, content_type, slug, data) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, 1, "blog_article", id, "{}").run();
}

async function seedTag(db, id) {
  await db.prepare(
    "INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)",
  ).bind(id, id, id).run();
}

describe("TagLinkRepo", () => {
  test("setItemTags replaces the prior set of links", async () => {
    const db = createMigratedInMemoryDatabase();
    const repo = new TagLinkRepo(db);

    try {
      await seedItem(db, "item0000001");
      await seedTag(db, "tag00000001");
      await seedTag(db, "tag00000002");
      await seedTag(db, "tag00000003");

      await repo.setItemTags("item0000001", ["tag00000001", "tag00000002"]);
      expect((await repo.getTagIdsForItem("item0000001")).sort()).toEqual(
        ["tag00000001", "tag00000002"].sort(),
      );

      await repo.setItemTags("item0000001", ["tag00000002", "tag00000003"]);
      expect((await repo.getTagIdsForItem("item0000001")).sort()).toEqual(
        ["tag00000002", "tag00000003"].sort(),
      );
    } finally {
      db.close();
    }
  });

  test("setItemTags with an empty array clears all links", async () => {
    const db = createMigratedInMemoryDatabase();
    const repo = new TagLinkRepo(db);

    try {
      await seedItem(db, "item0000001");
      await seedTag(db, "tag00000001");

      await repo.setItemTags("item0000001", ["tag00000001"]);
      expect(await repo.getTagIdsForItem("item0000001")).toEqual(["tag00000001"]);

      await repo.setItemTags("item0000001", []);
      expect(await repo.getTagIdsForItem("item0000001")).toEqual([]);
    } finally {
      db.close();
    }
  });

  test("getTagIdsForItem returns the tag ids linked to an item", async () => {
    const db = createMigratedInMemoryDatabase();
    const repo = new TagLinkRepo(db);

    try {
      await seedItem(db, "item0000001");
      await seedTag(db, "tag00000001");
      await seedTag(db, "tag00000002");

      await repo.setItemTags("item0000001", ["tag00000001", "tag00000002"]);

      const tagIds = await repo.getTagIdsForItem("item0000001");
      expect(tagIds.sort()).toEqual(["tag00000001", "tag00000002"].sort());
    } finally {
      db.close();
    }
  });

  test("getTagIdsForItem returns an empty array when there are no links", async () => {
    const db = createMigratedInMemoryDatabase();
    const repo = new TagLinkRepo(db);

    try {
      await seedItem(db, "item0000001");
      expect(await repo.getTagIdsForItem("item0000001")).toEqual([]);
    } finally {
      db.close();
    }
  });

  test("getItemIdsForTag returns the item ids linked to a tag", async () => {
    const db = createMigratedInMemoryDatabase();
    const repo = new TagLinkRepo(db);

    try {
      await seedItem(db, "item0000001");
      await seedItem(db, "item0000002");
      await seedTag(db, "tag00000001");

      await repo.setItemTags("item0000001", ["tag00000001"]);
      await repo.setItemTags("item0000002", ["tag00000001"]);

      const itemIds = await repo.getItemIdsForTag("tag00000001");
      expect(itemIds.sort()).toEqual(["item0000001", "item0000002"].sort());
    } finally {
      db.close();
    }
  });

  test("getItemIdsForTag returns an empty array when there are no links", async () => {
    const db = createMigratedInMemoryDatabase();
    const repo = new TagLinkRepo(db);

    try {
      await seedTag(db, "tag00000001");
      expect(await repo.getItemIdsForTag("tag00000001")).toEqual([]);
    } finally {
      db.close();
    }
  });
});
