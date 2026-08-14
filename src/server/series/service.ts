import {
  normalizeSeriesDescription,
  normalizeSeriesKind,
  normalizeSeriesName,
  normalizeSeriesNumber,
  normalizeSeriesSlug,
  seriesSlugFromName,
  type ItemSeriesRecord,
  type SeriesInput,
  type SeriesKind,
  type SeriesRecord,
  validateSeriesDescription,
  validateSeriesKind,
  validateSeriesName,
  validateSeriesSlug,
} from "@/shared/Series";
import {randomShortUUID} from "@/shared/StringUtils";

export class SeriesConflictError extends Error {}
export class SeriesRequestError extends Error {}

interface SeriesRow extends Record<string, unknown> {
  created_at: string;
  description: string | null;
  id: string;
  kind: string;
  name: string;
  slug: string;
  updated_at: string;
}

function recordFromRow(row: SeriesRow): SeriesRecord {
  return {
    date_created: String(row.created_at),
    date_modified: String(row.updated_at),
    description: row.description === null ? null : String(row.description),
    id: String(row.id),
    kind: row.kind === "podcast" ? "podcast" : "post",
    name: String(row.name),
    slug: String(row.slug),
  };
}

function validatedInput(input: SeriesInput): {
  description: string | null;
  kind: SeriesKind;
  name: string;
  slug: string;
} {
  const kind = normalizeSeriesKind(input.kind);
  const kindError = validateSeriesKind(kind);
  if (kindError) throw new SeriesRequestError(kindError);
  const resolvedKind: SeriesKind = kind as SeriesKind;
  const name = normalizeSeriesName(input.name ?? "");
  const nameError = validateSeriesName(name);
  if (nameError) throw new SeriesRequestError(nameError);
  const slug = normalizeSeriesSlug(input.slug ?? seriesSlugFromName(name));
  const slugError = validateSeriesSlug(slug);
  if (slugError) throw new SeriesRequestError(slugError);
  const description = normalizeSeriesDescription(input.description);
  const descriptionError = validateSeriesDescription(description);
  if (descriptionError) throw new SeriesRequestError(descriptionError);
  return {description, kind: resolvedKind, name, slug};
}

export async function listSeries(
  database: D1Database,
  kind?: SeriesKind,
): Promise<SeriesRecord[]> {
  if (kind) {
    const result = await database.prepare(`
      SELECT * FROM series WHERE kind = ?
      ORDER BY name COLLATE NOCASE, id
    `).bind(kind).all();
    return result.results.map((row) => recordFromRow(row as SeriesRow));
  }
  const result = await database.prepare(`
    SELECT * FROM series
    ORDER BY kind, name COLLATE NOCASE, id
  `).all();
  return result.results.map((row) => recordFromRow(row as SeriesRow));
}

export async function getSeriesById(
  database: D1Database,
  id: string,
): Promise<SeriesRecord | null> {
  const row = await database.prepare(
    "SELECT * FROM series WHERE id = ? LIMIT 1",
  ).bind(id).first<SeriesRow>();
  return row ? recordFromRow(row) : null;
}

export async function getSeriesBySlug(
  database: D1Database,
  kind: SeriesKind,
  slug: string,
): Promise<SeriesRecord | null> {
  const row = await database.prepare(
    "SELECT * FROM series WHERE kind = ? AND slug = ? COLLATE NOCASE LIMIT 1",
  ).bind(kind, slug).first<SeriesRow>();
  return row ? recordFromRow(row) : null;
}

async function assertSlugAvailable(
  database: D1Database,
  kind: SeriesKind,
  slug: string,
  seriesId?: string,
): Promise<void> {
  const row = await database.prepare(
    "SELECT id FROM series WHERE kind = ? AND slug = ? COLLATE NOCASE LIMIT 1",
  ).bind(kind, slug).first<{id: string}>();
  if (row && row.id !== seriesId) {
    throw new SeriesConflictError(
      `A ${kind} series with the slug \`${slug}\` already exists.`,
    );
  }
}

async function assertNameAvailable(
  database: D1Database,
  kind: SeriesKind,
  name: string,
  seriesId?: string,
): Promise<void> {
  const row = await database.prepare(
    "SELECT id FROM series WHERE kind = ? AND name = ? COLLATE NOCASE LIMIT 1",
  ).bind(kind, name).first<{id: string}>();
  if (row && row.id !== seriesId) {
    throw new SeriesConflictError(
      `A ${kind} series named \`${name}\` already exists.`,
    );
  }
}

export async function createSeries(
  database: D1Database,
  input: SeriesInput,
): Promise<SeriesRecord> {
  const {description, kind, name, slug} = validatedInput(input);
  await assertNameAvailable(database, kind, name);
  await assertSlugAvailable(database, kind, slug);
  const id = randomShortUUID();
  const now = new Date().toISOString();
  await database.prepare(`
    INSERT INTO series (id, kind, name, slug, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, kind, name, slug, description, now, now).run();
  return {
    date_created: now,
    date_modified: now,
    description,
    id,
    kind,
    name,
    slug,
  };
}

export async function updateSeries(
  database: D1Database,
  id: string,
  input: SeriesInput,
): Promise<SeriesRecord> {
  const existing = await getSeriesById(database, id);
  if (!existing) {
    throw new SeriesRequestError("Series not found.");
  }
  const kind = normalizeSeriesKind(input.kind) ?? existing.kind;
  const {description, name, slug} = validatedInput({
    description: input.description === undefined
      ? existing.description
      : input.description,
    kind,
    name: input.name ?? existing.name,
    slug: input.slug ?? existing.slug,
  });
  await assertNameAvailable(database, kind, name, id);
  await assertSlugAvailable(database, kind, slug, id);
  const now = new Date().toISOString();
  await database.prepare(`
    UPDATE series SET kind = ?, name = ?, slug = ?, description = ?, updated_at = ?
    WHERE id = ?
  `).bind(kind, name, slug, description, now, id).run();
  return {
    date_created: existing.date_created,
    date_modified: now,
    description,
    id,
    kind,
    name,
    slug,
  };
}

export async function deleteSeries(
  database: D1Database,
  id: string,
): Promise<void> {
  await database.batch([
    database.prepare("DELETE FROM item_series WHERE series_id = ?").bind(id),
    database.prepare("DELETE FROM series WHERE id = ?").bind(id),
  ]);
}

/**
 * Replaces the series assignment for one item. Passing an empty value clears
 * the assignment; a series number is optional and must be a positive integer.
 */
export async function assignItemSeries(
  database: D1Database,
  itemId: string,
  series: unknown,
): Promise<void> {
  const seriesId = typeof series === "string"
    ? series
    : (series as {id?: unknown})?.id;
  if (typeof seriesId !== "string" || seriesId.length === 0) {
    await database.prepare("DELETE FROM item_series WHERE item_id = ?")
      .bind(itemId).run();
    return;
  }
  const seriesNumber = normalizeSeriesNumber(
    (series as {series_number?: unknown})?.series_number,
  );
  await database.prepare(`
    INSERT INTO item_series (item_id, series_id, series_number)
    VALUES (?, ?, ?)
    ON CONFLICT (item_id) DO UPDATE SET
      series_id = excluded.series_id,
      series_number = excluded.series_number
  `).bind(itemId, seriesId, seriesNumber).run();
}

/**
 * Returns a map of item ID to its series assignment for the given item IDs.
 * Items without a series are absent from the map.
 */
export async function seriesForItems(
  database: D1Database,
  itemIds: string[],
): Promise<Map<string, ItemSeriesRecord>> {
  const byItem = new Map<string, ItemSeriesRecord>();
  if (itemIds.length === 0) return byItem;
  const placeholders = itemIds.map(() => "?").join(", ");
  const result = await database.prepare(`
    SELECT isr.item_id, isr.series_number, s.id, s.kind, s.name, s.slug,
      s.description, s.created_at, s.updated_at
    FROM item_series isr
    JOIN series s ON s.id = isr.series_id
    WHERE isr.item_id IN (${placeholders})
  `).bind(...itemIds).all();
  for (const row of result.results as Array<Record<string, unknown>>) {
    const itemId = String(row.item_id);
    byItem.set(itemId, {
      series: recordFromRow(row as unknown as SeriesRow),
      series_number: row.series_number === null ||
          row.series_number === undefined
        ? null
        : Number(row.series_number),
    });
  }
  return byItem;
}
