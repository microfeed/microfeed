import {randomShortUUID} from "@/shared/StringUtils";
import {
  automaticTagSlug, normalizeTagName, normalizedTagKey, normalizeTagSlug,
  tagNameError, tagSlugError, tagUrls, TagRequestError, TagConflictError,
  type TagRecord,
} from "@/shared/Tags";
import {characterIndexStatements} from "@/server/items/character-index";
import {commitDatabaseMutation, type DatabaseMutationCommit} from "@/server/mutation";

interface TagRow {
  id: string; name: string; slug: string; description: string;
  created_at: string; updated_at: string; published_item_count?: number;
}
const TAG_SELECT = `SELECT t.*, (SELECT count(*) FROM item_tags m
  JOIN items i ON i.id = m.item_id WHERE m.tag_id = t.id AND i.status = 1)
  AS published_item_count FROM tags t`;

function record(row: TagRow, origin: string): TagRecord {
  return {id: row.id, name: row.name, slug: row.slug, description: row.description,
    date_created: row.created_at, date_modified: row.updated_at,
    published_item_count: Number(row.published_item_count ?? 0), ...tagUrls(row.slug, origin)};
}

export async function getTag(database: D1Database, origin: string, reference: string, byId = false): Promise<TagRecord | null> {
  const row = await database.prepare(`${TAG_SELECT} WHERE t.${byId ? "id" : "slug"} = ? AND t.deleted_at IS NULL`)
    .bind(byId ? reference : normalizeTagSlug(reference)).first<TagRow>();
  return row ? record(row, origin) : null;
}

export async function resolveTagRoute(database: D1Database, origin: string, slug: string) {
  const row = await database.prepare(`${TAG_SELECT} JOIN tag_paths p ON p.tag_id = t.id
    WHERE p.slug = ? AND t.deleted_at IS NULL`).bind(normalizeTagSlug(slug)).first<TagRow>();
  return row ? record(row, origin) : null;
}

export async function listTags(database: D1Database, origin: string, limit = 20, cursor?: string) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TagRequestError("Use a limit between 1 and 100.", "limit");
  const rows = await database.prepare(`${TAG_SELECT} WHERE t.deleted_at IS NULL
    ${cursor ? "AND t.name_key > ?" : ""} ORDER BY t.name_key, t.id LIMIT ?`)
    .bind(...(cursor ? [cursor] : []), limit + 1).all<TagRow & {name_key: string}>();
  const items = rows.results.slice(0, limit).map(row => record(row, origin));
  return {items, ...(rows.results.length > limit ? {next_cursor: rows.results[limit - 1]!.name_key} : {})};
}

export async function saveTag(database: D1Database, origin: string, input: {name?: string; slug?: string; description?: string},
  existing?: TagRecord, commit?: DatabaseMutationCommit<TagRecord>): Promise<TagRecord> {
  const name = normalizeTagName(input.name ?? existing?.name ?? "");
  const nameError = tagNameError(name);
  if (nameError) throw new TagRequestError(nameError, "name");
  const id = existing?.id ?? randomShortUUID();
  let slug = normalizeTagSlug(input.slug ?? existing?.slug ?? automaticTagSlug(name));
  const slugError = tagSlugError(slug);
  if (slugError) throw new TagRequestError(slugError, "slug");
  // Historical slugs stay reserved so subscriptions can never change owners.
  for (let attempt = 0; attempt < 6; attempt++) {
    const path = await database.prepare("SELECT tag_id FROM tag_paths WHERE slug = ?").bind(slug).first<{tag_id: string}>();
    if (!path || path.tag_id === id) break;
    if (input.slug !== undefined || existing) throw new TagConflictError("This tag slug is already reserved.");
    const suffix = `-${id.toLowerCase()}${attempt || ""}`;
    slug = Array.from(automaticTagSlug(name)).slice(0, 100 - suffix.length).join("").replace(/-+$/u, "") + suffix;
  }
  const now = new Date().toISOString();
  const description = (input.description ?? existing?.description ?? "").trim();
  if (description.length > 10000) throw new TagRequestError("Use a tag description of 10000 characters or fewer.", "description");
  const result: TagRecord = {id, name, slug, description, date_created: existing?.date_created ?? now,
    date_modified: now, published_item_count: existing?.published_item_count ?? 0, ...tagUrls(slug, origin)};
  if (existing && name === existing.name && slug === existing.slug && description === existing.description) return existing;
  const statements = [database.prepare(`INSERT INTO tags (id, name, name_key, slug, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, name_key=excluded.name_key,
    slug=excluded.slug, description=excluded.description, updated_at=excluded.updated_at`)
    .bind(id, name, normalizedTagKey(name), slug, description, result.date_created, now),
    database.prepare("INSERT OR IGNORE INTO tag_paths (slug, tag_id) VALUES (?, ?)").bind(slug, id),
    ...characterIndexStatements(database, "tag", id, name, description)];
  try { await commitDatabaseMutation(database, statements, result, commit); }
  catch (error) {
    if (error instanceof Error && /tag_slug_conflict/u.test(error.message)) throw new TagConflictError("This tag slug is already reserved.");
    if (error instanceof Error && /UNIQUE constraint failed/u.test(error.message)) throw new TagConflictError("A tag with this name or slug already exists.");
    throw error;
  }
  return result;
}

export async function tagsForSiteFile(database: D1Database, origin: string, maximum: number) {
  const items: TagRecord[] = []; let cursor: string | undefined;
  do {
    const page = await listTags(database, origin, Math.min(100, maximum - items.length), cursor);
    items.push(...page.items); cursor = page.next_cursor;
  } while (cursor && items.length < maximum);
  return items;
}

export async function deleteTag(database: D1Database, tag: TagRecord, commit?: DatabaseMutationCommit<TagRecord>) {
  await commitDatabaseMutation(database, [
    database.prepare("DELETE FROM item_tags WHERE tag_id = ?").bind(tag.id),
    database.prepare("UPDATE tags SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), tag.id),
  ], tag, commit);
}

export async function itemTagMap(database: D1Database, origin: string, ids: string[]): Promise<Map<string, TagRecord[]>> {
  const result = new Map<string, TagRecord[]>();
  if (!ids.length) return result;
  const rows = await database.prepare(`SELECT t.*, m.item_id FROM tags t JOIN item_tags m ON m.tag_id = t.id
    WHERE t.deleted_at IS NULL AND m.item_id IN (SELECT value FROM json_each(?)) ORDER BY t.id`)
    .bind(JSON.stringify(ids)).all<TagRow & {item_id: string}>();
  for (const row of rows.results) {
    const list = result.get(row.item_id) ?? [];
    list.push(record(row, origin)); result.set(row.item_id, list);
  }
  return result;
}

export async function resolveItemTagAssignment(database: D1Database, origin: string, item: Record<string, unknown>): Promise<TagRecord[] | undefined> {
  const slugs = item.tag_slugs; const ids = item.tag_ids;
  if (slugs !== undefined && ids !== undefined) throw new TagRequestError("Use tag_slugs or tag_ids, not both.");
  const references = slugs ?? ids;
  if (references === undefined) return undefined;
  if (!Array.isArray(references) || references.some(ref => typeof ref !== "string" || !ref.trim()))
    throw new TagRequestError("Tags must be an array of existing tag references.");
  const values = [...new Set(references.map(ref => slugs !== undefined ? normalizeTagSlug(ref) : ref))];
  const rows = await database.prepare(`SELECT * FROM tags WHERE deleted_at IS NULL AND ${slugs !== undefined ? "slug" : "id"}
    IN (SELECT value FROM json_each(?)) ORDER BY id`).bind(JSON.stringify(values)).all<TagRow>();
  if (rows.results.length !== values.length) throw new TagRequestError("One or more tags do not exist.", slugs !== undefined ? "tag_slugs" : "tag_ids");
  return rows.results.map(row => record(row, origin));
}

export async function prepareItemTags(database: D1Database, origin: string, item: Record<string, unknown>): Promise<D1PreparedStatement[]> {
  const tags = await resolveItemTagAssignment(database, origin, item);
  if (tags === undefined) {
    item.tags = (await itemTagMap(database, origin, [String(item.id)])).get(String(item.id)) ?? [];
    return [];
  }
  item.tags = tags;
  delete item.tag_ids; delete item.tag_slugs;
  return [database.prepare("DELETE FROM item_tags WHERE item_id = ?").bind(String(item.id)),
    database.prepare(`INSERT INTO item_tags (item_id, tag_id) SELECT ?, value FROM json_each(?)`)
      .bind(String(item.id), JSON.stringify(tags.map(tag => tag.id)))];
}
