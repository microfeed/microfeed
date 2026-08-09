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
import {
  PUBLIC_URLS,
  urlJoin,
  urlJoinWithRelative,
} from "@/shared/StringUtils";
import {msToRFC3339, rfc3399ToMs} from "@/shared/TimeUtils";

const HIGHLIGHT_START = "\u0001";
const HIGHLIGHT_END = "\u0002";
const FUZZY_CANDIDATE_LIMIT = 250;

export interface SearchHighlightSegment {
  matched: boolean;
  text: string;
}

export interface ItemSearchResult {
  api_url: string;
  content_text: string;
  date_modified: string;
  date_modified_ms: number;
  date_published: string;
  date_published_ms: number;
  highlights: {
    content_text: SearchHighlightSegment[];
    title: SearchHighlightSegment[];
  };
  id: string;
  image?: string;
  match_type: "exact" | "fuzzy";
  relevance_score: number;
  status: ItemSearchStatus;
  title: string;
  web_url: string;
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
}

interface SearchCursor {
  fingerprint: string;
  id: string;
  phase: "exact" | "fuzzy";
  publishedAt: string;
  rank: number;
  version: 1;
}

interface SearchRow extends Record<string, unknown> {
  content_text: string;
  highlighted_content: string;
  highlighted_title: string;
  id: string;
  image: string | null;
  pub_date: string;
  search_rank: number;
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
      cursor.version !== 1 || cursor.fingerprint !== fingerprint ||
      (cursor.phase !== "exact" && cursor.phase !== "fuzzy") ||
      typeof cursor.rank !== "number" || !Number.isFinite(cursor.rank) ||
      typeof cursor.publishedAt !== "string" ||
      !Number.isFinite(Date.parse(cursor.publishedAt)) ||
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

function resultFromRow(
  row: SearchRow,
  request: Request,
  publicBucketUrl: string | undefined,
  matchType: "exact" | "fuzzy",
  titleSegments?: SearchHighlightSegment[],
): ItemSearchResult {
  const baseUrl = new URL(request.url).origin;
  const image = row.image
    ? urlJoinWithRelative(publicBucketUrl ?? "/media/", row.image, baseUrl)
    : undefined;
  const modifiedAtMs = rfc3399ToMs(row.updated_at);
  const publishedAtMs = rfc3399ToMs(row.pub_date);
  return {
    api_url: urlJoin(baseUrl, `${API_BASE_PATH}items/${row.id}/`),
    content_text: row.content_text,
    date_modified: msToRFC3339(modifiedAtMs),
    date_modified_ms: modifiedAtMs,
    date_published: msToRFC3339(publishedAtMs),
    date_published_ms: publishedAtMs,
    highlights: {
      content_text: matchType === "exact"
        ? segmentsFromMarked(row.highlighted_content)
        : [],
      title: titleSegments ?? segmentsFromMarked(row.highlighted_title),
    },
    id: row.id,
    ...(image ? {image} : {}),
    match_type: matchType,
    relevance_score: Number(Math.max(0, -row.search_rank).toPrecision(8)),
    status: statusName(row.status),
    title: row.title,
    web_url: PUBLIC_URLS.webItem(row.id, row.title, baseUrl),
  };
}

function parsedRows(rows: Array<Record<string, unknown>>): SearchRow[] {
  return rows.map((row) => ({
    content_text: String(row.content_text ?? ""),
    highlighted_content: String(row.highlighted_content ?? ""),
    highlighted_title: String(row.highlighted_title ?? row.title ?? ""),
    id: String(row.id ?? ""),
    image: typeof row.image === "string" ? row.image : null,
    pub_date: String(row.pub_date ?? ""),
    search_rank: Number(row.search_rank),
    status: Number(row.status),
    title: String(row.title ?? ""),
    updated_at: String(row.updated_at ?? ""),
  }));
}

function itemFilters(options: ItemSearchOptions): {
  bindings: unknown[];
  sql: string;
} {
  const statusValues = options.statuses.map((status) =>
    ITEM_STATUSES_STRINGS_DICT[status]
  );
  const clauses = [
    `i.status IN (${statusValues.map(() => "?").join(", ")})`,
  ];
  const bindings: unknown[] = [...statusValues];
  if (options.datePublishedMsGt !== undefined) {
    clauses.push("i.pub_date > ?");
    bindings.push(msToRFC3339(options.datePublishedMsGt));
  }
  if (options.datePublishedMsLt !== undefined) {
    clauses.push("i.pub_date < ?");
    bindings.push(msToRFC3339(options.datePublishedMsLt));
  }
  return {bindings, sql: clauses.join(" AND ")};
}

function cursorFilter(
  cursor: SearchCursor | undefined,
  rankExpression: string,
): {bindings: unknown[]; sql: string} {
  if (!cursor) return {bindings: [], sql: ""};
  return {
    bindings: [
      cursor.rank,
      cursor.rank,
      cursor.publishedAt,
      cursor.rank,
      cursor.publishedAt,
      cursor.id,
    ],
    sql: " AND (" +
      `${rankExpression} > ? OR (` +
      `${rankExpression} = ? AND i.pub_date < ?) OR (` +
      `${rankExpression} = ? AND i.pub_date = ? AND i.id > ?))`,
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
    publishedAt: row.pub_date,
    rank: row.search_rank,
    version: 1,
  };
}

async function searchReady(database: D1Database): Promise<boolean> {
  const row = await database.prepare(
    "SELECT ready FROM item_search_metadata WHERE id = 1",
  ).first<{ready: number}>();
  return row?.ready === 1;
}

async function exactRows(
  database: D1Database,
  options: ItemSearchOptions,
  ftsQuery: string,
  cursor: SearchCursor | undefined,
  limit: number,
): Promise<SearchRow[]> {
  const filters = itemFilters(options);
  const rank = "bm25(item_search_exact, 0.0, 5.0, 1.0)";
  const after = cursorFilter(cursor, rank);
  const sql = `
    SELECT
      i.id,
      i.status,
      COALESCE(json_extract(i.data, '$.title'), '') AS title,
      i.content_text,
      i.pub_date,
      i.updated_at,
      json_extract(i.data, '$.image') AS image,
      ${rank} AS search_rank,
      highlight(item_search_exact, 1, char(1), char(2)) AS highlighted_title,
      snippet(item_search_exact, 2, char(1), char(2), ' … ', 24)
        AS highlighted_content
    FROM item_search_exact
    JOIN items i ON i.rowid = item_search_exact.rowid
    WHERE item_search_exact MATCH ? AND ${filters.sql}${after.sql}
    ORDER BY search_rank ASC, i.pub_date DESC, i.id ASC
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
  const filters = itemFilters(options);
  const rank = "bm25(item_search_title_trigram)";
  const after = cursorFilter(cursor, rank);
  const sql = `
    SELECT
      i.id,
      i.status,
      COALESCE(json_extract(i.data, '$.title'), '') AS title,
      i.content_text,
      i.pub_date,
      i.updated_at,
      json_extract(i.data, '$.image') AS image,
      ${rank} AS search_rank,
      COALESCE(json_extract(i.data, '$.title'), '') AS highlighted_title,
      '' AS highlighted_content
    FROM item_search_title_trigram
    JOIN items i ON i.rowid = item_search_title_trigram.rowid
    WHERE item_search_title_trigram MATCH ?
      AND item_search_title_trigram.rowid NOT IN (
        SELECT rowid FROM item_search_exact WHERE item_search_exact MATCH ?
      )
      AND ${filters.sql}${after.sql}
    ORDER BY search_rank ASC, i.pub_date DESC, i.id ASC
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

export async function searchItems(
  database: D1Database,
  request: Request,
  options: ItemSearchOptions,
): Promise<ItemSearchResponse> {
  if (!await searchReady(database)) {
    throw new ItemSearchUnavailableError(
      "Item search is being prepared. Retry after deployment finishes.",
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
  const results: ItemSearchResult[] = [];

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
  const hasUnscannedCandidates = Boolean(lastScanned) && (
    candidates.length > scannable.indexOf(lastScanned!) + 1 ||
    scannable.at(-1) !== lastScanned
  );
  return {
    items: results,
    ...(lastScanned && (hasUnscannedCandidates || candidates.length > FUZZY_CANDIDATE_LIMIT)
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

export async function latestItems(
  database: D1Database,
  request: Request,
  limit = 5,
): Promise<ItemSearchResult[]> {
  if (!await searchReady(database)) {
    throw new ItemSearchUnavailableError(
      "Item search is being prepared. Retry after deployment finishes.",
    );
  }
  const response = await database.prepare(`
    SELECT
      id,
      status,
      COALESCE(json_extract(data, '$.title'), '') AS title,
      content_text,
      pub_date,
      updated_at,
      json_extract(data, '$.image') AS image,
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
  );
}
