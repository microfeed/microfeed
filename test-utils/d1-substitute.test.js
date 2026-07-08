const {
  createMigratedInMemoryDatabase,
} = require("./d1-substitute");

describe("D1 substitute", () => {
  test("bind/run/all/first/batch match the shapes the code expects", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const insertResult = await db
        .prepare("INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)")
        .bind("tag_1", "slug-one", "Slug One")
        .run();
      expect(insertResult).toEqual(expect.objectContaining({
        success: true,
        meta: expect.objectContaining({
          changes: 1,
        }),
      }));

      const selectStmt = db
        .prepare("SELECT id, slug, name FROM tags WHERE slug = ?")
        .bind("slug-one");
      await expect(selectStmt.all()).resolves.toEqual(expect.objectContaining({
        success: true,
        results: [
          {id: "tag_1", slug: "slug-one", name: "Slug One"},
        ],
      }));
      await expect(selectStmt.first()).resolves.toEqual({
        id: "tag_1",
        slug: "slug-one",
        name: "Slug One",
      });
      await expect(selectStmt.first("name")).resolves.toBe("Slug One");

      const batchResults = await db.batch([
        db.prepare("SELECT slug FROM tags WHERE id = ?").bind("tag_1"),
        db.prepare("INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)").bind("tag_2", "slug-two", "Slug Two"),
      ]);

      expect(batchResults).toHaveLength(2);
      expect(batchResults[0]).toEqual(expect.objectContaining({
        success: true,
        results: [{slug: "slug-one"}],
      }));
      expect(batchResults[1]).toEqual(expect.objectContaining({
        success: true,
        meta: expect.objectContaining({
          changes: 1,
        }),
      }));
    } finally {
      db.close();
    }
  });

  test("batch is atomic: a failing statement rolls back the whole batch", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      let batchFailed = false;
      try {
        await db.batch([
          db.prepare("INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)").bind("tag_1", "slug-one", "Slug One"),
          // Second insert violates the UNIQUE(slug) index and must abort the batch.
          db.prepare("INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)").bind("tag_2", "slug-one", "Dup Slug"),
        ]);
      } catch (error) {
        batchFailed = true;
      }
      expect(batchFailed).toBe(true);

      await expect(db.prepare("SELECT COUNT(*) AS count FROM tags").bind().first("count")).resolves.toBe(0);
    } finally {
      db.close();
    }
  });

  test("createMigratedInMemoryDatabase returns a fresh migrated database each time", async () => {
    const firstDb = createMigratedInMemoryDatabase();
    try {
      await firstDb.prepare("INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)")
        .bind("tag_1", "slug-one", "Slug One")
        .run();
    } finally {
      firstDb.close();
    }

    const secondDb = createMigratedInMemoryDatabase();
    try {
      await expect(secondDb.prepare("SELECT COUNT(*) AS count FROM tags").bind().first()).resolves.toEqual({count: 0});
    } finally {
      secondDb.close();
    }
  });
});
