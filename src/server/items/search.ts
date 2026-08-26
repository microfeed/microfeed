import {
  fuzzyTitleMatches,
  itemSearchFtsQuery,
  itemSearchTrigramQuery,
  normalizedSearchTokens,
  parseItemSearchQuery,
  type ItemSearchField,
  type ItemSearchStatus,
} from "@/shared/ItemSearch";
import {
  ITEM_STATUSES_DICT,
  ITEM_STATUSES_STRINGS_DICT,
  STATUSES,
} from "@/shared/Constants";
import {API_BASE_PATH} from "@/shared/ApiVersion";
import {DEFAULT_NOT_FOUND_PAGE_SLUG, publicPageUrl} from "@/shared/Pages";
import {
  PUBLIC_URLS,
  urlJoin,
  urlJoinWithRelative,
} from "@/shared/StringUtils";
import {msToRFC3339, rfc3399ToMs} from "@/shared/TimeUtils";

const HIGHLIGHT_START = "\u0001";
const HIGHLIGHT_END = "\u0002";
const FUZZY_CANDIDATE_LIMIT = 250;

export type SearchContentType = "item" | "page";

export interface SearchHighlightSegment {
  matched: boolean;
  text: string;
}

interface BaseSearchResult {
  api_url: string;
  content_text: string;
  date_modified: string;
  date_modified_ms: number;
  date_published?: string;
  date_published_ms?: number;
  highlights: {
    content_text: SearchHighlightSegment[];
    title: SearchHighlightSegment[];
  };
  id: string;
  match_type: "exact" | "fuzzy";
  relevance_score: number;
  status: ItemSearchStatus;
  title: string;
  type: SearchContentType;
  web_url: string;
}

export interface ItemSearchResult extends BaseSearchResult {
  attachment_url?: string;
  date_published: string;
  date_published_ms: number;
  image?: string;
  item_url?: string;
  type: "item";
}

export interface PageSearchResult extends BaseSearchResult {
  is_not_found_page: false;
  meta_description?: string;
  navigation_label: string;
  navigation_order: number;
  show_in_navigation: boolean;
  slug: string;
  type: "page";
}

export type ContentSearchResult = ItemSearchResult | PageSearchResult;

export interface ContentSearchResponse {
  items: ContentSearchResult[];
  next_cursor?: string;
}

export interface ItemSearchResponse {
  items: ItemSearchResult[];
  next_cursor?: string;
}

export interface ItemSearchOptions {
  datePublishedMsGt?: number;
  datePublishedMsLt?: number;
  fields: ItemSearchField[];
  limit: number;
  nextCursor?: string;
  publicBucketUrl?: string;
  query: string;
  statuses: ItemSearchStatus[];
  types?: SearchContentType[];
}

interface SearchCursor {
  fingerprint: string;
  id: string;
  phase: "exact" | "fuzzy";
  rank: number;
  sortAt: string;
  type: SearchContentType;
  version: 2;
}

interface SearchRow extends Record<string, unknown> {
  attachment_url: string | null;
  content_text: string;
  content_type: SearchContentType;
  highlighted_content: string;
  highlighted_title: string;
  id: string;
  image: string | null;
  item_url: string | null;
  meta_description: string | null;
  navigation_label: string;
  navigation_order: number;
  pub_date: string;
  search_rank: number;
  show_in_navigation: number;
  slug: string;
  sort_at: string;
  status: number;
  title: string;
  updated_at: string;
}

export class ItemSearchRequestError extends Error {}
export class ItemSearchUnavailableError extends Error {}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_")
    .replace(/=+$/gu, "");
}

function decodeBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    const padded = value.replace(/-/gu, "+").replace(/_/gu, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return new TextDecoder().decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
  } catch {
    return null;
  }
}

async function searchFingerprint(options: ItemSearchOptions): Promise<string> {
  const canonical = JSON.stringify({
    datePublishedMsGt: options.datePublishedMsGt ?? null,
    datePublishedMsLt: options.datePublishedMsLt ?? null,
    fields: [...options.fields].sort(),
    query: options.query,
    statuses: [...options.statuses].sort(),
    types: [...(options.types ?? ["item"])].sort(),
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return Array.from(new Uint8Array(digest).slice(0, 12))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function encodeSearchCursor(cursor: SearchCursor): string {
  return encodeBase64Url(JSON.stringify(cursor));
}

function decodeSearchCursor(
  value: string | undefined,
  fingerprint: string,
): SearchCursor | undefined {
  if (!value) return undefined;
  const decoded = decodeBase64Url(value);
  if (!decoded) throw new ItemSearchRequestError("Invalid next_cursor.");
  try {
    const cursor = JSON.parse(decoded) as Partial<SearchCursor>;
    if (
      cursor.version !== 2 || cursor.fingerprint !== fingerprint ||
      (cursor.phase !== "exact" && cursor.phase !== "fuzzy") ||
      (cursor.type !== "item" && cursor.type !== "page") ||
      typeof cursor.rank !== "number" || !Number.isFinite(cursor.rank) ||
      typeof cursor.sortAt !== "string" ||
      !Number.isFinite(Date.parse(cursor.sortAt)) ||
      typeof cursor.id !== "string" || !cursor.id
    ) {
      throw new Error("invalid");
    }
    return cursor as SearchCursor;
  } catch {
    throw new ItemSearchRequestError("Invalid next_cursor.");
  }
}

function segmentsFromMarked(value: string): SearchHighlightSegment[] {
  const segments: SearchHighlightSegment[] = [];
  let matched = false;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const marker = value[index];
    if (marker !== HIGHLIGHT_START && marker !== HIGHLIGHT_END) continue;
    if (index > start) {
      segments.push({matched, text: value.slice(start, index)});
    }
    matched = marker === HIGHLIGHT_START;
    start = index + 1;
  }
  if (start < value.length) segments.push({matched, text: value.slice(start)});
  return segments.length > 0 ? segments : [{matched: false, text: value}];
}

function fuzzyTitleSegments(
  title: string,
  matchedTokens: ReadonlySet<string>,
): SearchHighlightSegment[] {
  const segments: SearchHighlightSegment[] = [];
  const expression = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
  let previous = 0;
  for (const match of title.matchAll(expression)) {
    const index = match.index ?? 0;
    if (index > previous) {
      segments.push({matched: false, text: title.slice(previous, index)});
    }
    const normalized = normalizedSearchTokens(match[0])[0] ?? "";
    segments.push({matched: matchedTokens.has(normalized), text: match[0]});
    previous = index + match[0].length;
  }
  if (previous < title.length) {
    segments.push({matched: false, text: title.slice(previous)});
  }
  return segments.length > 0 ? segments : [{matched: false, text: title}];
}

function statusName(value: number): ItemSearchStatus {
  const name = ITEM_STATUSES_DICT[value]?.name;
  return name === "published" || name === "unlisted" || name === "unpublished"
    ? name
    : "unpublished";
}

function optionalDate(value: string): {iso: string; milliseconds: number} | null {
  const milliseconds = rfc3399ToMs(value);
  return Number.isFinite(milliseconds)
    ? {iso: msToRFC3339(milliseconds), milliseconds}
    : null;
}

function resultFromRow(
  row: SearchRow,
  request: Request,
  publicBucketUrl: string | undefined,
  matchType: "exact" | "fuzzy",
  titleSegments?: SearchHighlightSegment[],
): ContentSearchResult {
  const baseUrl = new URL(request.url).origin;
  const modified = optionalDate(row.updated_at) ?? {
    iso: new Date(0).toISOString(),
    milliseconds: 0,
  };
  const published = optionalDate(row.pub_date);
  const common: BaseSearchResult = {
    api_url: urlJoin(
      baseUrl,
      `${API_BASE_PATH}${row.content_type === "item" ? "items" : "pages"}/${row.id}/`,
    ),
    content_text: row.content_text,
    date_modified: modified.iso,
    date_modified_ms: modified.milliseconds,
    ...(published
      ? {
          date_published: published.iso,
          date_published_ms: published.milliseconds,
        }
      : {}),
    highlights: {
      content_text: matchType === "exact"
        ? segmentsFromMarked(row.highlighted_content)
        : [],
      title: titleSegments ?? segmentsFromMarked(row.highlighted_title),
    },
    id: row.id,
    match_type: matchType,
    relevance_score: Number(Math.max(0, -row.search_rank).toPrecision(8)),
    status: statusName(row.status),
    title: row.title,
    type: row.content_type,
    web_url: row.content_type === "item"
      ? PUBLIC_URLS.webItem(row.id, row.title, baseUrl)
      : publicPageUrl(row.slug, baseUrl),
  };
  if (row.content_type === "page") {
    return {
      ...common,
      is_not_found_page: false,
      ...(row.meta_description
        ? {meta_description: row.meta_description}
        : {}),
      navigation_label: row.navigation_label,
      navigation_order: row.navigation_order,
      show_in_navigation: Boolean(row.show_in_navigation),
      slug: row.slug,
      type: "page",
    };
  }
  const image = row.image
    ? urlJoinWithRelative(publicBucketUrl ?? "/media/", row.image, baseUrl)
    : undefined;
  const itemUrl = row.item_url
    ? urlJoinWithRelative(baseUrl, row.item_url, baseUrl)
    : undefined;
  const attachmentUrl = row.attachment_url
    ? urlJoinWithRelative(
        publicBucketUrl ?? "/media/",
        row.attachment_url,
        baseUrl,
      )
    : undefined;
  const itemPublished = published ?? {
    iso: new Date(0).toISOString(),
    milliseconds: 0,
  };
  return {
    ...common,
    ...(attachmentUrl ? {attachment_url: attachmentUrl} : {}),
    date_published: itemPublished.iso,
    date_published_ms: itemPublished.milliseconds,
    ...(image ? {image} : {}),
    ...(itemUrl ? {item_url: itemUrl} : {}),
    type: "item",
  };
}

function parsedRows(rows: Array<Record<string, unknown>>): SearchRow[] {
  return rows.map((row) => ({
    attachment_url: typeof row.attachment_url === "string"
      ? row.attachment_url
      : null,
    content_text: String(row.content_text ?? ""),
    content_type: row.content_type === "page" ? "page" : "item",
    highlighted_content: String(row.highlighted_content ?? ""),
    highlighted_title: String(row.highlighted_title ?? row.title ?? ""),
    id: String(row.id ?? ""),
    image: typeof row.image === "string" ? row.image : null,
    item_url: typeof row.item_url === "string" ? row.item_url : null,
    meta_description: typeof row.meta_description === "string"
      ? row.meta_description
      : null,
    navigation_label: String(row.navigation_label ?? ""),
    navigation_order: Number(row.navigation_order ?? 0),
    pub_date: String(row.pub_date ?? ""),
    search_rank: Number(row.search_rank),
    show_in_navigation: Number(row.show_in_navigation ?? 0),
    slug: String(row.slug ?? ""),
    sort_at: String(row.sort_at ?? row.updated_at ?? ""),
    status: Number(row.status),
    title: String(row.title ?? ""),
    updated_at: String(row.updated_at ?? ""),
  }));
}

function contentFilters(options: ItemSearchOptions): {
  bindings: unknown[];
  sql: string;
} {
  const statusValues = options.statuses.map((status) =>
    ITEM_STATUSES_STRINGS_DICT[status]
  );
  const types = [...new Set(options.types ?? ["item"])]
    .filter((type): type is SearchContentType =>
      type === "item" || type === "page"
    );
  if (types.length === 0) {
    throw new ItemSearchRequestError("Select at least one search type.");
  }
  const clauses = [
    `d.status IN (${statusValues.map(() => "?").join(", ")})`,
    `d.content_type IN (${types.map(() => "?").join(", ")})`,
    "NOT (d.content_type = 'page' AND p.slug = ? COLLATE NOCASE)",
  ];
  const bindings: unknown[] = [
    ...statusValues,
    ...types,
    DEFAULT_NOT_FOUND_PAGE_SLUG,
  ];
  if (options.datePublishedMsGt !== undefined) {
    clauses.push("d.published_at > ?");
    bindings.push(msToRFC3339(options.datePublishedMsGt));
  }
  if (options.datePublishedMsLt !== undefined) {
    clauses.push("d.published_at < ?");
    bindings.push(msToRFC3339(options.datePublishedMsLt));
  }
  return {bindings, sql: clauses.join(" AND ")};
}

function cursorFilter(
  cursor: SearchCursor | undefined,
  rankExpression: string,
): {bindings: unknown[]; sql: string} {
  if (!cursor) return {bindings: [], sql: ""};
  const sortAt = "COALESCE(d.published_at, d.updated_at)";
  return {
    bindings: [
      cursor.rank,
      cursor.rank,
      cursor.sortAt,
      cursor.rank,
      cursor.sortAt,
      cursor.type,
      cursor.rank,
      cursor.sortAt,
      cursor.type,
      cursor.id,
    ],
    sql: " AND (" +
      `${rankExpression} > ? OR (` +
      `${rankExpression} = ? AND ${sortAt} < ?) OR (` +
      `${rankExpression} = ? AND ${sortAt} = ? AND d.content_type > ?) OR (` +
      `${rankExpression} = ? AND ${sortAt} = ? AND d.content_type = ? ` +
      "AND d.content_id > ?))",
  };
}

function cursorForRow(
  row: SearchRow,
  fingerprint: string,
  phase: "exact" | "fuzzy",
): SearchCursor {
  return {
    fingerprint,
    id: row.id,
    phase,
    rank: row.search_rank,
    sortAt: row.sort_at,
    type: row.content_type,
    version: 2,
  };
}

async function searchReady(database: D1Database): Promise<boolean> {
  const row = await database.prepare(
    "SELECT ready FROM site_search_metadata WHERE id = 1",
  ).first<{ready: number}>();
  return row?.ready === 1;
}

const SEARCH_SELECT = `
  d.content_id AS id,
  d.content_type,
  d.status,
  d.title,
  d.content_text,
  COALESCE(d.published_at, '') AS pub_date,
  d.updated_at,
  COALESCE(d.published_at, d.updated_at) AS sort_at,
  d.image,
  json_extract(i.data, '$.link') AS item_url,
  json_extract(i.data, '$.mediaFile.url') AS attachment_url,
  COALESCE(p.slug, '') AS slug,
  p.meta_description,
  COALESCE(p.show_in_navigation, 0) AS show_in_navigation,
  COALESCE(p.navigation_label, '') AS navigation_label,
  COALESCE(p.navigation_order, 0) AS navigation_order`;

async function exactRows(
  database: D1Database,
  options: ItemSearchOptions,
  ftsQuery: string,
  cursor: SearchCursor | undefined,
  limit: number,
): Promise<SearchRow[]> {
  const filters = contentFilters(options);
  const rank = "bm25(site_search_exact, 0.0, 0.0, 5.0, 1.0)";
  const after = cursorFilter(cursor, rank);
  const sql = `
    SELECT
      ${SEARCH_SELECT},
      ${rank} AS search_rank,
      highlight(site_search_exact, 2, char(1), char(2)) AS highlighted_title,
      snippet(site_search_exact, 3, char(1), char(2), ' … ', 24)
        AS highlighted_content
    FROM site_search_exact
    JOIN site_search_documents d ON d.id = site_search_exact.rowid
    LEFT JOIN items i
      ON d.content_type = 'item' AND i.id = d.content_id
    LEFT JOIN pages p
      ON d.content_type = 'page' AND p.id = d.content_id
    WHERE site_search_exact MATCH ? AND ${filters.sql}${after.sql}
    ORDER BY search_rank ASC, sort_at DESC, d.content_type ASC, d.content_id ASC
    LIMIT ?
  `;
  const response = await database.prepare(sql).bind(
    ftsQuery,
    ...filters.bindings,
    ...after.bindings,
    limit,
  ).all();
  return parsedRows(response.results);
}

async function fuzzyRows(
  database: D1Database,
  options: ItemSearchOptions,
  trigramQuery: string,
  exactQuery: string,
  cursor: SearchCursor | undefined,
): Promise<SearchRow[]> {
  const filters = contentFilters(options);
  const rank = "bm25(site_search_title_trigram, 0.0, 0.0, 1.0)";
  const after = cursorFilter(cursor, rank);
  const sql = `
    SELECT
      ${SEARCH_SELECT},
      ${rank} AS search_rank,
      d.title AS highlighted_title,
      '' AS highlighted_content
    FROM site_search_title_trigram
    JOIN site_search_documents d
      ON d.id = site_search_title_trigram.rowid
    LEFT JOIN items i
      ON d.content_type = 'item' AND i.id = d.content_id
    LEFT JOIN pages p
      ON d.content_type = 'page' AND p.id = d.content_id
    WHERE site_search_title_trigram MATCH ?
      AND site_search_title_trigram.rowid NOT IN (
        SELECT rowid FROM site_search_exact WHERE site_search_exact MATCH ?
      )
      AND ${filters.sql}${after.sql}
    ORDER BY search_rank ASC, sort_at DESC, d.content_type ASC, d.content_id ASC
    LIMIT ?
  `;
  const response = await database.prepare(sql).bind(
    trigramQuery,
    exactQuery,
    ...filters.bindings,
    ...after.bindings,
    FUZZY_CANDIDATE_LIMIT + 1,
  ).all();
  return parsedRows(response.results);
}

export async function searchContent(
  database: D1Database,
  request: Request,
  options: ItemSearchOptions,
): Promise<ContentSearchResponse> {
  if (!await searchReady(database)) {
    throw new ItemSearchUnavailableError(
      "Search is being prepared. Retry after deployment finishes.",
    );
  }
  if (
    options.datePublishedMsGt !== undefined &&
    options.datePublishedMsLt !== undefined &&
    options.datePublishedMsGt >= options.datePublishedMsLt
  ) {
    throw new ItemSearchRequestError(
      "date_published_ms_gt must be less than date_published_ms_lt.",
    );
  }
  const clauses = parseItemSearchQuery(options.query);
  if (clauses.length === 0) {
    throw new ItemSearchRequestError("Search query has no searchable terms.");
  }
  const exactQuery = itemSearchFtsQuery(clauses, options.fields);
  const trigramQuery = options.fields.includes("title")
    ? itemSearchTrigramQuery(clauses)
    : null;
  const fingerprint = await searchFingerprint(options);
  const cursor = decodeSearchCursor(options.nextCursor, fingerprint);
  const results: ContentSearchResult[] = [];

  if (!cursor || cursor.phase === "exact") {
    const rows = await exactRows(
      database,
      options,
      exactQuery,
      cursor,
      options.limit + 1,
    );
    const pageRows = rows.slice(0, options.limit);
    results.push(...pageRows.map((row) => resultFromRow(
      row,
      request,
      options.publicBucketUrl,
      "exact",
    )));
    if (results.length === options.limit) {
      return {
        items: results,
        ...(rows.length > options.limit || trigramQuery
          ? {
              next_cursor: encodeSearchCursor(cursorForRow(
                pageRows.at(-1)!,
                fingerprint,
                "exact",
              )),
            }
          : {}),
      };
    }
  }

  if (!trigramQuery) return {items: results};

  const fuzzyCursor = cursor?.phase === "fuzzy" ? cursor : undefined;
  const candidates = await fuzzyRows(
    database,
    options,
    trigramQuery,
    exactQuery,
    fuzzyCursor,
  );
  const scannable = candidates.slice(0, FUZZY_CANDIDATE_LIMIT);
  let lastScanned: SearchRow | undefined;
  for (const row of scannable) {
    lastScanned = row;
    const match = fuzzyTitleMatches(row.title, clauses);
    if (!match.matches) continue;
    results.push(resultFromRow(
      row,
      request,
      options.publicBucketUrl,
      "fuzzy",
      fuzzyTitleSegments(row.title, match.matchedTokens),
    ));
    if (results.length === options.limit) break;
  }
  const lastIndex = lastScanned ? scannable.indexOf(lastScanned) : -1;
  const hasUnscannedCandidates = Boolean(lastScanned) && (
    candidates.length > lastIndex + 1 || scannable.at(-1) !== lastScanned
  );
  return {
    items: results,
    ...(lastScanned &&
        (hasUnscannedCandidates || candidates.length > FUZZY_CANDIDATE_LIMIT)
      ? {
          next_cursor: encodeSearchCursor(cursorForRow(
            lastScanned,
            fingerprint,
            "fuzzy",
          )),
        }
      : {}),
  };
}

export async function searchItems(
  database: D1Database,
  request: Request,
  options: ItemSearchOptions,
): Promise<ItemSearchResponse> {
  const response = await searchContent(database, request, {
    ...options,
    types: ["item"],
  });
  return {
    items: response.items.filter(
      (item): item is ItemSearchResult => item.type === "item",
    ),
    ...(response.next_cursor ? {next_cursor: response.next_cursor} : {}),
  };
}

export async function latestItems(
  database: D1Database,
  request: Request,
  limit = 5,
): Promise<ItemSearchResult[]> {
  if (!await searchReady(database)) {
    throw new ItemSearchUnavailableError(
      "Search is being prepared. Retry after deployment finishes.",
    );
  }
  const response = await database.prepare(`
    SELECT
      id,
      'item' AS content_type,
      status,
      COALESCE(json_extract(data, '$.title'), '') AS title,
      content_text,
      pub_date,
      updated_at,
      COALESCE(pub_date, updated_at) AS sort_at,
      json_extract(data, '$.image') AS image,
      '' AS slug,
      NULL AS meta_description,
      0 AS show_in_navigation,
      '' AS navigation_label,
      0 AS navigation_order,
      0 AS search_rank,
      COALESCE(json_extract(data, '$.title'), '') AS highlighted_title,
      '' AS highlighted_content
    FROM items
    WHERE status != ?
    ORDER BY updated_at DESC, id DESC
    LIMIT ?
  `).bind(STATUSES.DELETED, limit).all();
  return parsedRows(response.results).map((row) =>
    resultFromRow(row, request, undefined, "exact")
  ).filter((item): item is ItemSearchResult => item.type === "item");
}
