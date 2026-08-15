import {
  ITEM_STATUSES_DICT,
  ITEM_STATUSES_STRINGS_DICT,
  STATUSES,
} from "@/shared/Constants";
import {
  DEFAULT_NOT_FOUND_PAGE_SLUG,
  isNotFoundPageSlug,
  normalizePageSlug,
  pageNavigationEnabledForStatus,
  publicPageUrl,
  type PageNavigationEntry,
  type PageRecord,
  validatePageSlug,
} from "@/shared/Pages";
import type {AdminPageSummary} from "@/shared/AdminCollections";
import {htmlToPlainText, randomShortUUID} from "@/shared/StringUtils";
import {storedThemeFromRow} from "@/shared/themes/ThemeRows";
import type FeedDb from "@/server/feed/FeedDb";
import {PUBLIC_CACHE_TAGS} from "@/server/cache/public-cache";
import {themeSupportsPagesAndSearch} from "@/server/themes/Theme";

export interface PageInput {
  content_html?: string;
  meta_description?: string | null;
  navigation_label?: string;
  show_in_navigation?: boolean;
  slug?: string;
  status?: "published" | "unlisted" | "unpublished" | number;
  title?: string;
}

export interface PageListOptions {
  excludeNotFoundPage?: boolean;
  limit?: number;
  nextCursor?: string;
  statuses?: Array<"published" | "unlisted" | "unpublished">;
}

export interface PageListResponse {
  items: PageRecord[];
  next_cursor?: string;
}

export interface ResolvedPagePath {
  page: PageRecord;
  redirect: boolean;
}

export class PageConflictError extends Error {}
export class PageRequestError extends Error {}
export class PageThemeUnsupportedError extends Error {}

interface PageRow extends Record<string, unknown> {
  content_html: string;
  content_text: string;
  created_at: string;
  id: string;
  meta_description: string | null;
  navigation_label: string;
  navigation_order: number;
  published_at: string | null;
  show_in_navigation: number;
  slug: string;
  status: number;
  title: string;
  updated_at: string;
}

function statusValue(value: PageInput["status"], fallback: number): number {
  if (typeof value === "number" && Object.values(STATUSES).includes(value)) {
    return value;
  }
  return (ITEM_STATUSES_STRINGS_DICT as Readonly<Record<string, number>>)[
    String(value ?? "")
  ] ?? fallback;
}

function statusName(value: number): PageRecord["status"] {
  const status = ITEM_STATUSES_DICT[value]?.name;
  return status === "published" || status === "unlisted" ||
      status === "unpublished"
    ? status
    : "unpublished";
}

function isPublicStatus(value: number): boolean {
  return value === STATUSES.PUBLISHED || value === STATUSES.UNLISTED;
}

function encodeCursor(row: PageRow): string {
  const bytes = new TextEncoder().encode(JSON.stringify({
    id: row.id,
    updatedAt: row.updated_at,
    version: 1,
  }));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_")
    .replace(/=+$/gu, "");
}

function decodeCursor(value: string): {id: string; updatedAt: string} {
  try {
    const padded = value.replace(/-/gu, "+").replace(/_/gu, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const decoded = new TextDecoder().decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
    const cursor = JSON.parse(decoded) as Record<string, unknown>;
    if (
      cursor.version !== 1 || typeof cursor.id !== "string" ||
      typeof cursor.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(cursor.updatedAt))
    ) {
      throw new Error("invalid");
    }
    return {id: cursor.id, updatedAt: cursor.updatedAt};
  } catch {
    throw new PageRequestError("Invalid next_cursor.");
  }
}

function pageFromRow(row: PageRow, baseUrl: string): PageRecord {
  const status = statusName(Number(row.status));
  return {
    content_html: String(row.content_html ?? ""),
    content_text: String(row.content_text ?? ""),
    date_created: String(row.created_at),
    date_modified: String(row.updated_at),
    ...(row.published_at
      ? {date_published: String(row.published_at)}
      : {}),
    id: String(row.id),
    is_not_found_page: isNotFoundPageSlug(row.slug),
    ...(row.meta_description
      ? {meta_description: String(row.meta_description)}
      : {}),
    navigation_label: String(row.navigation_label ?? ""),
    navigation_order: Number(row.navigation_order ?? 0),
    show_in_navigation: pageNavigationEnabledForStatus(
      status,
      Boolean(row.show_in_navigation),
    ),
    slug: String(row.slug),
    status,
    title: String(row.title),
    url: publicPageUrl(String(row.slug), baseUrl),
  };
}

function rows(results: Array<Record<string, unknown>>): PageRow[] {
  return results.map((row) => row as PageRow);
}

export async function activeThemeSupportsPages(
  database: D1Database,
): Promise<boolean> {
  const row = await database.prepare(`
    SELECT themes.*, theme_state.active_theme_id AS requested_active_theme_id
    FROM theme_state
    LEFT JOIN themes ON themes.id = theme_state.active_theme_id
      AND themes.deleted_at IS NULL
    WHERE theme_state.id = 'current'
    LIMIT 1
  `).first<Record<string, unknown>>();
  if (!row?.requested_active_theme_id || !row.id) {
    return themeSupportsPagesAndSearch(null);
  }
  try {
    return themeSupportsPagesAndSearch(storedThemeFromRow(row));
  } catch {
    return themeSupportsPagesAndSearch(null);
  }
}

async function assertSlugAvailable(
  database: D1Database,
  slug: string,
  pageId?: string,
): Promise<void> {
  const row = await database.prepare(
    "SELECT page_id FROM page_paths WHERE slug = ? COLLATE NOCASE LIMIT 1",
  ).bind(slug).first<{page_id: string}>();
  if (row && row.page_id !== pageId) {
    throw new PageConflictError(`The path /${slug}/ is already reserved.`);
  }
}

function validatedSlug(value: string, adminPath?: string | null): string {
  const slug = normalizePageSlug(value);
  const error = validatePageSlug(slug, adminPath);
  if (error) throw new PageRequestError(error);
  return slug;
}

async function purgePageCaches(database: FeedDb, pageId: string): Promise<void> {
  await database.purgePublicCacheTags([
    PUBLIC_CACHE_TAGS.PAGES,
    PUBLIC_CACHE_TAGS.page(pageId),
    PUBLIC_CACHE_TAGS.ITEMS,
  ]);
}

async function nextNavigationOrder(
  database: D1Database,
  excludePageId?: string,
): Promise<number> {
  const row = await database.prepare(`
    SELECT COALESCE(MAX(navigation_order), 0) + 10 AS value
    FROM pages
    WHERE status != ? AND show_in_navigation = 1
      ${excludePageId ? "AND id != ?" : ""}
  `).bind(
    STATUSES.DELETED,
    ...(excludePageId ? [excludePageId] : []),
  ).first<{value?: number}>();
  return Number(row?.value ?? 10);
}

export async function listPages(
  database: FeedDb,
  request: Request,
  options: PageListOptions = {},
): Promise<PageListResponse> {
  const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
  const statuses = options.statuses ?? [
    "published",
    "unlisted",
    "unpublished",
  ];
  const statusValues = statuses.map((status) =>
    ITEM_STATUSES_STRINGS_DICT[status]
  );
  const clauses = [
    `status IN (${statusValues.map(() => "?").join(", ")})`,
  ];
  const bindings: unknown[] = [...statusValues];
  if (options.excludeNotFoundPage) {
    clauses.push("slug != ? COLLATE NOCASE");
    bindings.push(DEFAULT_NOT_FOUND_PAGE_SLUG);
  }
  if (options.nextCursor) {
    const cursor = decodeCursor(options.nextCursor);
    clauses.push("(updated_at < ? OR (updated_at = ? AND id < ?))");
    bindings.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
  }
  const result = await database.FEED_DB.prepare(`
    SELECT * FROM pages
    WHERE ${clauses.join(" AND ")}
    ORDER BY updated_at DESC, id DESC
    LIMIT ?
  `).bind(...bindings, limit + 1).all();
  const pageRows = rows(result.results);
  const visible = pageRows.slice(0, limit);
  const baseUrl = new URL(request.url).origin;
  return {
    items: visible.map((row) => pageFromRow(row, baseUrl)),
    ...(pageRows.length > limit && visible.length > 0
      ? {next_cursor: encodeCursor(visible.at(-1)!)}
      : {}),
  };
}

export async function listAdminPageSummaries(
  database: D1Database,
): Promise<AdminPageSummary[]> {
  const statusValues = [
    STATUSES.PUBLISHED,
    STATUSES.UNLISTED,
    STATUSES.UNPUBLISHED,
  ];
  const result = await database.prepare(`
    SELECT
      id,
      slug,
      status,
      title,
      show_in_navigation,
      navigation_label,
      navigation_order
    FROM pages
    WHERE status IN (${statusValues.map(() => "?").join(", ")})
    ORDER BY updated_at DESC, id DESC
    LIMIT 100
  `).bind(...statusValues).all<Pick<
    PageRow,
    | "id"
    | "navigation_label"
    | "navigation_order"
    | "show_in_navigation"
    | "slug"
    | "status"
    | "title"
  >>();
  return result.results.map((row) => {
    const status = statusName(Number(row.status));
    return {
      id: String(row.id),
      is_not_found_page: isNotFoundPageSlug(row.slug),
      navigation_label: String(row.navigation_label ?? ""),
      navigation_order: Number(row.navigation_order ?? 0),
      show_in_navigation: pageNavigationEnabledForStatus(
        status,
        Boolean(row.show_in_navigation),
      ),
      slug: String(row.slug),
      status,
      title: String(row.title),
    };
  });
}

export async function getPageById(
  database: D1Database,
  request: Request,
  id: string,
  includeDeleted = false,
): Promise<PageRecord | null> {
  const row = await database.prepare(
    `SELECT * FROM pages WHERE id = ?${includeDeleted ? "" : " AND status != ?"} LIMIT 1`,
  ).bind(...(includeDeleted ? [id] : [id, STATUSES.DELETED])).first<PageRow>();
  return row ? pageFromRow(row, new URL(request.url).origin) : null;
}

export async function createPage(
  database: FeedDb,
  request: Request,
  input: PageInput,
  options: {adminPath?: string | null; id?: string} = {},
): Promise<PageRecord> {
  const title = String(input.title ?? "").trim();
  if (!title) throw new PageRequestError("A Page title is required.");
  const slug = validatedSlug(input.slug ?? "", options.adminPath);
  await assertSlugAvailable(database.FEED_DB, slug);
  const status = statusValue(input.status, STATUSES.UNPUBLISHED);
  if (isPublicStatus(status) && !await activeThemeSupportsPages(database.FEED_DB)) {
    throw new PageThemeUnsupportedError(
      "Activate a format v2 theme before publishing a Page.",
    );
  }
  const id = options.id ?? randomShortUUID();
  const now = new Date().toISOString();
  const contentHtml = String(input.content_html ?? "");
  const showInNavigation = pageNavigationEnabledForStatus(
    status,
    input.show_in_navigation !== false,
  );
  const navigationLabel = String(input.navigation_label ?? "").trim();
  if (showInNavigation && !navigationLabel) {
    throw new PageRequestError(
      "Enter a navigation label, or turn off Show in navigation.",
    );
  }
  const nextOrder = showInNavigation
    ? await nextNavigationOrder(database.FEED_DB)
    : 0;
  try {
    await database.FEED_DB.batch([
      database.FEED_DB.prepare(`
        INSERT INTO pages (
          id, slug, title, content_html, content_text, status,
          meta_description, show_in_navigation, navigation_label,
          navigation_order, published_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        slug,
        title,
        contentHtml,
        htmlToPlainText(contentHtml),
        status,
        input.meta_description?.trim() || null,
        showInNavigation ? 1 : 0,
        navigationLabel,
        nextOrder,
        isPublicStatus(status) ? now : null,
        now,
        now,
      ),
      database.FEED_DB.prepare(
        "INSERT INTO page_paths (slug, page_id, is_current, created_at) VALUES (?, ?, 1, ?)",
      ).bind(slug, id, now),
    ]);
  } catch (error) {
    if (String(error).toLocaleLowerCase().includes("unique")) {
      throw new PageConflictError(`The path /${slug}/ is already reserved.`);
    }
    throw error;
  }
  await purgePageCaches(database, id);
  return (await getPageById(database.FEED_DB, request, id))!;
}

export async function updatePage(
  database: FeedDb,
  request: Request,
  id: string,
  input: PageInput,
  options: {adminPath?: string | null} = {},
): Promise<PageRecord | null> {
  const existingRow = await database.FEED_DB.prepare(
    "SELECT * FROM pages WHERE id = ? AND status != ? LIMIT 1",
  ).bind(id, STATUSES.DELETED).first() as PageRow | null;
  if (!existingRow) return null;

  const title = input.title === undefined
    ? existingRow.title
    : String(input.title).trim();
  if (!title) throw new PageRequestError("A Page title is required.");
  const notFoundPage = isNotFoundPageSlug(existingRow.slug);
  if (
    notFoundPage && input.slug !== undefined &&
    !isNotFoundPageSlug(input.slug)
  ) {
    throw new PageRequestError(
      "The default 404 Page always uses the /404/ path.",
    );
  }
  if (
    notFoundPage && input.status !== undefined &&
    statusValue(input.status, existingRow.status) !== STATUSES.PUBLISHED
  ) {
    throw new PageRequestError(
      "The default 404 Page is always published.",
    );
  }
  if (notFoundPage && input.show_in_navigation === true) {
    throw new PageRequestError(
      "The default 404 Page cannot be shown in navigation.",
    );
  }
  const slug = notFoundPage
    ? DEFAULT_NOT_FOUND_PAGE_SLUG
    : input.slug === undefined
    ? existingRow.slug
    : validatedSlug(input.slug, options.adminPath);
  const slugChanged = slug !== normalizePageSlug(existingRow.slug);
  if (slugChanged) await assertSlugAvailable(database.FEED_DB, slug, id);
  const status = notFoundPage
    ? STATUSES.PUBLISHED
    : statusValue(input.status, existingRow.status);
  const becomingPublic = isPublicStatus(status) && !isPublicStatus(existingRow.status);
  if (becomingPublic && !await activeThemeSupportsPages(database.FEED_DB)) {
    throw new PageThemeUnsupportedError(
      "Activate a format v2 theme before publishing a Page.",
    );
  }
  const now = new Date().toISOString();
  const contentHtml = input.content_html === undefined
    ? existingRow.content_html
    : String(input.content_html);
  const previousShowInNavigation = pageNavigationEnabledForStatus(
    existingRow.status,
    Boolean(existingRow.show_in_navigation),
  );
  const showInNavigation = notFoundPage
    ? false
    : status === STATUSES.UNLISTED
    ? false
    : input.show_in_navigation === undefined
    ? previousShowInNavigation
    : input.show_in_navigation;
  const navigationLabel = notFoundPage
    ? title
    : input.navigation_label === undefined
    ? String(existingRow.navigation_label ?? "")
    : input.navigation_label.trim();
  if (showInNavigation && !navigationLabel) {
    throw new PageRequestError(
      "Enter a navigation label, or turn off Show in navigation.",
    );
  }
  const navigationOrder = notFoundPage
    ? 0
    : showInNavigation && !previousShowInNavigation
    ? await nextNavigationOrder(database.FEED_DB, id)
    : existingRow.navigation_order;
  const statements = [];
  if (slugChanged) {
    statements.push(
      database.FEED_DB.prepare(
        "UPDATE page_paths SET is_current = 0 WHERE page_id = ? AND is_current = 1",
      ).bind(id),
      database.FEED_DB.prepare(
        "INSERT INTO page_paths (slug, page_id, is_current, created_at) VALUES (?, ?, 1, ?)",
      ).bind(slug, id, now),
    );
  }
  statements.push(database.FEED_DB.prepare(`
    UPDATE pages SET
      slug = ?, title = ?, content_html = ?, content_text = ?, status = ?,
      meta_description = ?, show_in_navigation = ?, navigation_label = ?,
      navigation_order = ?, published_at = ?, updated_at = ?
    WHERE id = ? AND status != ?
  `).bind(
    slug,
    title,
    contentHtml,
    htmlToPlainText(contentHtml),
    status,
    input.meta_description === undefined
      ? existingRow.meta_description
      : input.meta_description?.trim() || null,
    showInNavigation ? 1 : 0,
    navigationLabel,
    navigationOrder,
    existingRow.published_at ?? (isPublicStatus(status) ? now : null),
    now,
    id,
    STATUSES.DELETED,
  ));
  try {
    await database.FEED_DB.batch(statements);
  } catch (error) {
    if (String(error).toLocaleLowerCase().includes("unique")) {
      throw new PageConflictError(`The path /${slug}/ is already reserved.`);
    }
    throw error;
  }
  await purgePageCaches(database, id);
  return getPageById(database.FEED_DB, request, id);
}

export async function reorderPageNavigation(
  database: FeedDb,
  pageIds: string[],
): Promise<void> {
  if (new Set(pageIds).size !== pageIds.length) {
    throw new PageRequestError("Each navigation Page can appear only once.");
  }
  const result = await database.FEED_DB.prepare(`
    SELECT id FROM pages
    WHERE status != ? AND show_in_navigation = 1
    ORDER BY navigation_order ASC, title COLLATE NOCASE ASC, id ASC
  `).bind(STATUSES.DELETED).all();
  const currentIds = (result.results as Array<{id: string}>).map(({id}) =>
    String(id)
  );
  const requestedIds = new Set(pageIds);
  if (
    currentIds.length !== pageIds.length ||
    currentIds.some((id) => !requestedIds.has(id))
  ) {
    throw new PageConflictError(
      "Page navigation changed. Refresh the Pages screen and try again.",
    );
  }
  if (pageIds.length === 0) return;

  const now = new Date().toISOString();
  await database.FEED_DB.batch(pageIds.map((id, index) =>
    database.FEED_DB.prepare(`
      UPDATE pages SET navigation_order = ?, updated_at = ?
      WHERE id = ? AND status != ? AND show_in_navigation = 1
    `).bind((index + 1) * 10, now, id, STATUSES.DELETED)
  ));
  await database.purgePublicCacheTags([
    PUBLIC_CACHE_TAGS.PAGES,
    PUBLIC_CACHE_TAGS.ITEMS,
    ...pageIds.map((id) => PUBLIC_CACHE_TAGS.page(id)),
  ]);
}

export async function deletePage(
  database: FeedDb,
  id: string,
): Promise<boolean> {
  const existing = await database.FEED_DB.prepare(
    "SELECT slug FROM pages WHERE id = ? AND status != ? LIMIT 1",
  ).bind(id, STATUSES.DELETED).first() as {slug: string} | null;
  if (existing && isNotFoundPageSlug(existing.slug)) {
    throw new PageRequestError("The default 404 Page cannot be deleted.");
  }
  const result = await database.FEED_DB.prepare(
    "UPDATE pages SET status = ?, updated_at = ? WHERE id = ? AND status != ?",
  ).bind(
    STATUSES.DELETED,
    new Date().toISOString(),
    id,
    STATUSES.DELETED,
  ).run();
  if (!result.meta.changes) return false;
  await purgePageCaches(database, id);
  return true;
}

export async function resolvePagePath(
  database: D1Database,
  request: Request,
  slugValue: string,
): Promise<ResolvedPagePath | null> {
  const slug = normalizePageSlug(slugValue);
  const row = await database.prepare(`
    SELECT pages.*, page_paths.is_current
    FROM page_paths
    JOIN pages ON pages.id = page_paths.page_id
    WHERE page_paths.slug = ? COLLATE NOCASE
      AND pages.status IN (?, ?)
    LIMIT 1
  `).bind(slug, STATUSES.PUBLISHED, STATUSES.UNLISTED).first<
    PageRow & {is_current: number}
  >();
  if (!row) return null;
  return {
    page: pageFromRow(row, new URL(request.url).origin),
    redirect: !Boolean(row.is_current),
  };
}

export async function navigationPages(
  database: D1Database,
  request: Request,
): Promise<PageNavigationEntry[]> {
  const result = await database.prepare(`
    SELECT * FROM pages
    WHERE status = ? AND show_in_navigation = 1
    ORDER BY navigation_order ASC, title COLLATE NOCASE ASC, id ASC
  `).bind(STATUSES.PUBLISHED).all();
  const baseUrl = new URL(request.url).origin;
  return rows(result.results).map((row) => {
    const page = pageFromRow(row, baseUrl);
    return {
      id: page.id,
      navigation_label: page.navigation_label,
      navigation_order: page.navigation_order,
      slug: page.slug,
      title: page.title,
      url: page.url,
    };
  });
}
