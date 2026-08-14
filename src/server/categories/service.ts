import {
  categorySlugFromName,
  MAX_CATEGORIES_PER_ITEM,
  normalizeCategoryName,
  normalizeCategorySlug,
  type CategoryInput,
  type CategoryRecord,
  validateCategoryName,
  validateCategorySlug,
} from "@/shared/Categories";
import {randomShortUUID} from "@/shared/StringUtils";

export class CategoryConflictError extends Error {}
export class CategoryRequestError extends Error {}

interface CategoryRow extends Record<string, unknown> {
  created_at: string;
  id: string;
  name: string;
  slug: string;
  updated_at: string;
}

function recordFromRow(row: CategoryRow): CategoryRecord {
  return {
    date_created: String(row.created_at),
    date_modified: String(row.updated_at),
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
  };
}

function validatedInput(input: CategoryInput): {
  name: string;
  slug: string;
} {
  const name = normalizeCategoryName(input.name ?? "");
  const nameError = validateCategoryName(name);
  if (nameError) throw new CategoryRequestError(nameError);
  const slug = normalizeCategorySlug(
    input.slug ?? categorySlugFromName(name),
  );
  const slugError = validateCategorySlug(slug);
  if (slugError) throw new CategoryRequestError(slugError);
  return {name, slug};
}

async function assertSlugAvailable(
  database: D1Database,
  slug: string,
  categoryId?: string,
): Promise<void> {
  const row = await database.prepare(
    "SELECT id FROM categories WHERE slug = ? COLLATE NOCASE LIMIT 1",
  ).bind(slug).first<{id: string}>();
  if (row && row.id !== categoryId) {
    throw new CategoryConflictError(
      `A category with the slug \`${slug}\` already exists.`,
    );
  }
}

async function assertNameAvailable(
  database: D1Database,
  name: string,
  categoryId?: string,
): Promise<void> {
  const row = await database.prepare(
    "SELECT id FROM categories WHERE name = ? COLLATE NOCASE LIMIT 1",
  ).bind(name).first<{id: string}>();
  if (row && row.id !== categoryId) {
    throw new CategoryConflictError(
      `A category named \`${name}\` already exists.`,
    );
  }
}

export async function listCategories(
  database: D1Database,
): Promise<CategoryRecord[]> {
  const result = await database.prepare(`
    SELECT * FROM categories
    ORDER BY name COLLATE NOCASE, id
  `).all();
  return result.results.map((row) => recordFromRow(row as CategoryRow));
}

export async function getCategoryById(
  database: D1Database,
  id: string,
): Promise<CategoryRecord | null> {
  const row = await database.prepare(
    "SELECT * FROM categories WHERE id = ? LIMIT 1",
  ).bind(id).first<CategoryRow>();
  return row ? recordFromRow(row) : null;
}

export async function getCategoryBySlug(
  database: D1Database,
  slug: string,
): Promise<CategoryRecord | null> {
  const row = await database.prepare(
    "SELECT * FROM categories WHERE slug = ? COLLATE NOCASE LIMIT 1",
  ).bind(slug).first<CategoryRow>();
  return row ? recordFromRow(row) : null;
}

export async function createCategory(
  database: D1Database,
  input: CategoryInput,
): Promise<CategoryRecord> {
  const {name, slug} = validatedInput(input);
  await assertNameAvailable(database, name);
  await assertSlugAvailable(database, slug);
  const id = randomShortUUID();
  const now = new Date().toISOString();
  await database.prepare(`
    INSERT INTO categories (id, name, slug, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, name, slug, now, now).run();
  return {
    date_created: now,
    date_modified: now,
    id,
    name,
    slug,
  };
}

export async function updateCategory(
  database: D1Database,
  id: string,
  input: CategoryInput,
): Promise<CategoryRecord> {
  const existing = await getCategoryById(database, id);
  if (!existing) {
    throw new CategoryRequestError("Category not found.");
  }
  const {name, slug} = validatedInput({
    name: input.name ?? existing.name,
    slug: input.slug ?? existing.slug,
  });
  await assertNameAvailable(database, name, id);
  await assertSlugAvailable(database, slug, id);
  const now = new Date().toISOString();
  await database.prepare(`
    UPDATE categories SET name = ?, slug = ?, updated_at = ?
    WHERE id = ?
  `).bind(name, slug, now, id).run();
  return {
    date_created: existing.date_created,
    date_modified: now,
    id,
    name,
    slug,
  };
}

export async function deleteCategory(
  database: D1Database,
  id: string,
): Promise<void> {
  await database.batch([
    database.prepare("DELETE FROM item_categories WHERE category_id = ?")
      .bind(id),
    database.prepare("DELETE FROM categories WHERE id = ?").bind(id),
  ]);
}

/**
 * Replaces the category assignments for one item. At most
 * MAX_CATEGORIES_PER_ITEM categories are kept; extra entries are dropped.
 */
export async function assignItemCategories(
  database: D1Database,
  itemId: string,
  categoryIds: unknown,
): Promise<void> {
  const normalized = Array.isArray(categoryIds)
    ? categoryIds.filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      )
    : [];
  const unique = [...new Set(normalized)].slice(0, MAX_CATEGORIES_PER_ITEM);
  if (unique.length === 0) {
    await database.prepare(
      "DELETE FROM item_categories WHERE item_id = ?",
    ).bind(itemId).run();
    return;
  }
  const statements = [
    database.prepare("DELETE FROM item_categories WHERE item_id = ?")
      .bind(itemId),
    ...unique.map((categoryId, position) =>
      database.prepare(`
        INSERT INTO item_categories (item_id, category_id, position)
        VALUES (?, ?, ?)
      `).bind(itemId, categoryId, position)
    ),
  ];
  await database.batch(statements);
}

/**
 * Returns a map of item ID to its ordered category records for the given
 * item IDs. Items without categories are absent from the map.
 */
export async function categoriesForItems(
  database: D1Database,
  itemIds: string[],
): Promise<Map<string, CategoryRecord[]>> {
  const byItem = new Map<string, CategoryRecord[]>();
  if (itemIds.length === 0) return byItem;
  const placeholders = itemIds.map(() => "?").join(", ");
  const result = await database.prepare(`
    SELECT ic.item_id, c.id, c.name, c.slug, c.created_at, c.updated_at
    FROM item_categories ic
    JOIN categories c ON c.id = ic.category_id
    WHERE ic.item_id IN (${placeholders})
    ORDER BY ic.item_id, ic.position
  `).bind(...itemIds).all();
  for (const row of result.results as Array<Record<string, unknown>>) {
    const itemId = String(row.item_id);
    const list = byItem.get(itemId) ?? [];
    list.push(recordFromRow(row as unknown as CategoryRow));
    byItem.set(itemId, list);
  }
  return byItem;
}

export async function categoryUsageCounts(
  database: D1Database,
): Promise<Map<string, number>> {
  const result = await database.prepare(`
    SELECT category_id, COUNT(*) AS count
    FROM item_categories
    GROUP BY category_id
  `).all();
  const counts = new Map<string, number>();
  for (const row of result.results as Array<Record<string, unknown>>) {
    counts.set(String(row.category_id), Number(row.count ?? 0));
  }
  return counts;
}
