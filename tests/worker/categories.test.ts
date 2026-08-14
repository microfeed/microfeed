import {env} from "cloudflare:workers";
import {beforeEach, describe, expect, it} from "vitest";

import FeedDb from "@/server/feed/FeedDb";
import {
  assignItemCategories,
  categoriesForItems,
  CategoryConflictError,
  CategoryRequestError,
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  updateCategory,
} from "@/server/categories/service";
import {MAX_CATEGORIES_PER_ITEM} from "@/shared/Categories";
import {STATUSES} from "@/shared/Constants";
import {loadCategoryLandingPage} from "@/server/taxonomy/public";

const ORIGIN = "https://feed.example.com";

async function database(pathname = "/"): Promise<FeedDb> {
  const request = new Request(`${ORIGIN}${pathname}`);
  const db = new FeedDb(env, request);
  await db.getContent();
  return db;
}

async function saveItem(
  db: FeedDb,
  id: string,
  title: string,
  categories?: string[],
): Promise<void> {
  await db.putContent({
    item: {
      categories,
      description: `<p>${title}</p>`,
      id,
      pubDateMs: Date.parse("2026-08-01T10:00:00.000Z"),
      status: STATUSES.PUBLISHED,
      title,
    },
  });
}

beforeEach(async () => {
  await env.FEED_DB.prepare("DELETE FROM item_categories").run();
  await env.FEED_DB.prepare("DELETE FROM categories").run();
  await env.FEED_DB.prepare("DELETE FROM items WHERE id LIKE 'cat-%'").run();
});

describe("categories service", () => {
  it("creates, lists, updates, and deletes categories", async () => {
    const db = await database();
    const created = await createCategory(db.FEED_DB, {name: "Essays"});
    expect(created.name).toBe("Essays");
    expect(created.slug).toBe("essays");
    expect(created.id).toBeTruthy();

    const listed = await listCategories(db.FEED_DB);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({name: "Essays", slug: "essays"});

    const updated = await updateCategory(db.FEED_DB, created.id, {
      name: "Long-form",
    });
    expect(updated.name).toBe("Long-form");
    expect(updated.slug).toBe("essays");

    await deleteCategory(db.FEED_DB, created.id);
    expect(await listCategories(db.FEED_DB)).toHaveLength(0);
    expect(await getCategoryById(db.FEED_DB, created.id)).toBeNull();
  });

  it("rejects duplicate names and slugs", async () => {
    const db = await database();
    await createCategory(db.FEED_DB, {name: "Essays"});
    await expect(createCategory(db.FEED_DB, {name: "essays"}))
      .rejects.toBeInstanceOf(CategoryConflictError);
    await expect(createCategory(db.FEED_DB, {name: "Notes", slug: "essays"}))
      .rejects.toBeInstanceOf(CategoryConflictError);
  });

  it("rejects empty names", async () => {
    const db = await database();
    await expect(createCategory(db.FEED_DB, {name: "  "}))
      .rejects.toBeInstanceOf(CategoryRequestError);
  });

  it("enforces a maximum of two categories per item", async () => {
    const db = await database();
    const a = await createCategory(db.FEED_DB, {name: "A"});
    const b = await createCategory(db.FEED_DB, {name: "B"});
    const c = await createCategory(db.FEED_DB, {name: "C"});

    await assignItemCategories(db.FEED_DB, "cat-item-1", [
      a.id,
      b.id,
      c.id,
    ]);
    const byItem = await categoriesForItems(db.FEED_DB, ["cat-item-1"]);
    expect(byItem.get("cat-item-1")?.map((category) => category.id))
      .toEqual([a.id, b.id]);
    expect(byItem.get("cat-item-1")).toHaveLength(MAX_CATEGORIES_PER_ITEM);
  });

  it("clears assignments when an empty list is provided", async () => {
    const db = await database();
    const a = await createCategory(db.FEED_DB, {name: "A"});
    await assignItemCategories(db.FEED_DB, "cat-item-2", [a.id]);
    await assignItemCategories(db.FEED_DB, "cat-item-2", []);
    const byItem = await categoriesForItems(db.FEED_DB, ["cat-item-2"]);
    expect(byItem.get("cat-item-2")).toBeUndefined();
  });
});

describe("item category persistence", () => {
  it("round-trips categories through putContent and getContent", async () => {
    const db = await database();
    const a = await createCategory(db.FEED_DB, {name: "Essays"});
    const b = await createCategory(db.FEED_DB, {name: "Notes"});

    await saveItem(db, "cat-item-3", "Hello", [a.id, b.id]);
    const content = await db.getContent({
      limit: 10,
      queryKwargs: {id: "cat-item-3"},
      searchParams: new URLSearchParams(),
    });
    const item = content.items?.[0];
    expect(item).toBeTruthy();
    expect(item.categories).toMatchObject([
      {id: a.id, name: "Essays", slug: "essays"},
      {id: b.id, name: "Notes", slug: "notes"},
    ]);
  });

  it("drops categories beyond the maximum when saving an item", async () => {
    const db = await database();
    const a = await createCategory(db.FEED_DB, {name: "A"});
    const b = await createCategory(db.FEED_DB, {name: "B"});
    const c = await createCategory(db.FEED_DB, {name: "C"});

    await saveItem(db, "cat-item-4", "Too many", [a.id, b.id, c.id]);
    const content = await db.getContent({
      limit: 10,
      queryKwargs: {id: "cat-item-4"},
      searchParams: new URLSearchParams(),
    });
    expect(content.items?.[0]?.categories?.map((category: any) => category.id))
      .toEqual([a.id, b.id]);
  });

  it("exposes categories in the public JSON feed", async () => {
    const db = await database();
    const a = await createCategory(db.FEED_DB, {name: "Essays"});
    await saveItem(db, "cat-item-5", "Public post", [a.id]);

    const publicFeed = await db.getPublicJsonData(
      await db.getContent({
        limit: 10,
        queryKwargs: {id: "cat-item-5"},
        searchParams: new URLSearchParams(),
      }),
      true,
    );
    const item = publicFeed.items?.[0];
    expect(item.categories).toEqual([
      {
        id: a.id,
        name: "Essays",
        slug: "essays",
        url: "https://feed.example.com/category/essays/",
      },
    ]);
  });

  it("builds a category landing page with only its items", async () => {
    const db = await database();
    const a = await createCategory(db.FEED_DB, {name: "Essays"});
    await saveItem(db, "cat-item-6", "In category", [a.id]);
    await saveItem(db, "cat-item-7", "Not in category");

    const result = await loadCategoryLandingPage(
      env,
      new Request(`${ORIGIN}/category/essays/`),
      "essays",
    );

    expect(result.kind).toBe("page");
    if (result.kind !== "page") return;
    expect(result.layout.title).toBe("Essays");
    expect(result.layout.canonicalUrl).toBe(
      "https://feed.example.com/category/essays/",
    );
    expect(result.layout.bodyHtml).toContain("In category");
    expect(result.layout.bodyHtml).not.toContain("Not in category");
  });

  it("returns not-found for an unknown category slug", async () => {
    const db = await database();
    await createCategory(db.FEED_DB, {name: "Essays"});

    const result = await loadCategoryLandingPage(
      env,
      new Request(`${ORIGIN}/category/missing/`),
      "missing",
    );
    expect(result.kind).toBe("not-found");
  });
});
