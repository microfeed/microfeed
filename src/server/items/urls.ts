import {STATUSES} from "@/shared/Constants";
import {automaticItemSlug, decodeItemRoute, legacyItemPath, legacyRouteId, normalizeItemSlug} from "@/shared/ItemUrls";
import {ContentCustomizationError} from "@/shared/Seo";

interface RouteRow {
  id: string;
  legacy_title: string | null;
  public_path: string | null;
  url_mode: "auto" | "custom" | "legacy";
  url_frozen: number;
  url_revision: number;
}

export async function prepareItemUrl(db: D1Database, item: Record<string, any>) {
  const current = await db.prepare(
    "SELECT id, CASE WHEN public_path IS NULL THEN json_extract(data, '$.title') END AS legacy_title, " +
      "public_path, url_mode, url_frozen, url_revision FROM items WHERE id = ?",
  ).bind(item.id).first<RouteRow>();
  const custom = item.applySlug !== undefined;
  const existingPath = current?.public_path ?? (current
    ? legacyItemPath({id: current.id, title: current.legacy_title ?? undefined}) : undefined);
  const mode = custom ? "custom" : current?.url_mode ?? "auto";
  const frozen = custom || Boolean(current?.url_frozen) ||
    [STATUSES.PUBLISHED, STATUSES.UNLISTED].includes(item.status);
  let path = existingPath;
  if (custom || !path || (mode === "auto" && !current?.url_frozen)) {
    const slug = custom ? normalizeItemSlug(String(item.applySlug ?? ""))
      : automaticItemSlug(String(item.title ?? ""));
    // Indexed range covers the base and every numeric suffix in one query.
    const prefix = `/i/${slug}`;
    const reservations = await db.prepare(
      "SELECT path, item_id FROM item_paths WHERE path >= ? AND path < ?",
    ).bind(prefix, `${prefix}\uffff`).all<{path: string; item_id: string}>();
    const taken = new Set(reservations.results.filter((row) => row.item_id !== item.id).map((row) => row.path));
    let suffix = 1;
    path = `${prefix}/`;
    while (taken.has(path)) {
      if (custom) throw new ContentCustomizationError("This item URL is already reserved. Choose another URL.", 409);
      path = `${prefix}-${++suffix}/`;
    }
    const legacyId = legacyRouteId(path);
    if (legacyId && legacyId !== item.id) {
      const reservedId = await db.prepare("SELECT 1 FROM item_paths WHERE path = ?").bind(`/i/${legacyId}/`).first();
      if (reservedId) {
        if (custom) throw new ContentCustomizationError("This URL is reserved for an existing item ID.", 409);
        // A suffix makes the candidate distinct from the reserved ID route.
        do { path = `${prefix}-${++suffix}/`; } while (taken.has(path));
      }
    }
  }
  item.publicPath = path;
  item.urlMode = mode;
  item.urlFrozen = frozen;
  const changed = !current?.public_path || path !== current.public_path ||
    mode !== current.url_mode || Number(frozen) !== current.url_frozen;
  return {
    exists: Boolean(current),
    statement: changed ? db.prepare(
      "UPDATE items SET public_path = ?, url_mode = ?, url_frozen = max(url_frozen * (url_mode != 'legacy'), ?), " +
      "url_revision = CASE WHEN url_revision = ? THEN url_revision + 1 ELSE -1 END WHERE id = ?",
    ).bind(path, mode, Number(frozen), current?.url_revision ?? 0, item.id) : undefined,
  };
}

/** One indexed history lookup; ID aliases are retained even after deletion. */
export async function resolveItemRoute(db: D1Database, segment: string): Promise<string | null> {
  const decoded = decodeItemRoute(segment);
  if (!decoded) return null;
  const path = `/i/${decoded}/`;
  const normalized = `/i/${decoded.normalize("NFC").toLowerCase().normalize("NFC")}/`;
  const row = await db.prepare(
    "SELECT item_id FROM item_paths WHERE path IN (?, ?) ORDER BY (path = ?) DESC LIMIT 1",
  ).bind(path, normalized, path).first<{item_id: string}>();
  // Historical title-ID spellings have always accepted any title prefix.
  return row?.item_id ?? legacyRouteId(path);
}

export function itemUrlWriteError(error: unknown): ContentCustomizationError | undefined {
  const message = String(error);
  if (/item_path_conflict|items.public_path|url_revision >= 0/u.test(message)) {
    return new ContentCustomizationError("The item URL was claimed or changed by another save. Refresh and choose an available URL.", 409);
  }
  return undefined;
}
