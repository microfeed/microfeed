import {SyntaxValidator} from "fast-xml-validator";

import {
  normalizeSiteFilename,
  publicSiteFilePath,
  type SiteFileGenerator,
  type SiteFileMediaType,
  type SiteFileRecord,
  SITE_FILE_GENERATORS,
  SITE_FILE_MEDIA_TYPES,
  siteFileMediaTypeForName,
  validateSiteFileContent,
  validateSiteFilename,
} from "@/shared/SiteFiles";
import {randomShortUUID} from "@/shared/StringUtils";
import type FeedDb from "@/server/feed/FeedDb";
import {PUBLIC_CACHE_TAGS} from "@/server/cache/public-cache";

export interface SiteFileInput {
  content_type?: SiteFileMediaType;
  draft_content?: string;
  enabled?: boolean;
  filename?: string;
}

export class SiteFileConflictError extends Error {}
export class SiteFileRequestError extends Error {}

interface SiteFileRow extends Record<string, unknown> {
  content_type: SiteFileMediaType;
  created_at: string;
  draft_content: string;
  enabled: number;
  filename: string;
  generator: SiteFileGenerator | null;
  id: string;
  mode: "generated" | "override";
  published_at: string | null;
  published_content: string | null;
  updated_at: string;
}

function recordFromRow(row: SiteFileRow, baseUrl: string): SiteFileRecord {
  return {
    content_type: row.content_type,
    date_created: String(row.created_at),
    date_modified: String(row.updated_at),
    ...(row.published_at
      ? {date_published: String(row.published_at)}
      : {}),
    draft_content: String(row.draft_content ?? ""),
    enabled: Boolean(row.enabled),
    filename: String(row.filename),
    ...(row.generator ? {generator: row.generator} : {}),
    id: String(row.id),
    mode: row.mode,
    ...(row.published_content !== null
      ? {published_content: String(row.published_content)}
      : {}),
    system: Boolean(row.generator),
    url: new URL(publicSiteFilePath(row.filename), baseUrl).toString(),
  };
}

function validatedMediaType(value: unknown): SiteFileMediaType {
  if (!SITE_FILE_MEDIA_TYPES.includes(value as SiteFileMediaType)) {
    throw new SiteFileRequestError("Choose a supported text content type.");
  }
  return value as SiteFileMediaType;
}

function assertPublishableContent(
  content: string,
  contentType: SiteFileMediaType,
): void {
  const error = validateSiteFileContent(content, contentType);
  if (error) throw new SiteFileRequestError(error);
  if (
    (contentType === "application/xml" ||
      contentType === "application/rss+xml")
  ) {
    try {
      SyntaxValidator.validate(content);
    } catch {
      throw new SiteFileRequestError("Publish valid XML content.");
    }
  }
}

async function purgeSiteFileCaches(
  database: FeedDb,
  siteFileId: string,
): Promise<void> {
  await database.purgePublicCacheTags([
    PUBLIC_CACHE_TAGS.SITE_FILES,
    PUBLIC_CACHE_TAGS.siteFile(siteFileId),
  ]);
}

export async function listSiteFiles(
  database: D1Database,
  request: Request,
): Promise<SiteFileRecord[]> {
  const result = await database.prepare(`
    SELECT * FROM site_files
    ORDER BY generator IS NULL, filename COLLATE NOCASE, id
  `).all();
  const baseUrl = new URL(request.url).origin;
  return result.results.map((row) =>
    recordFromRow(row as SiteFileRow, baseUrl)
  );
}

export async function getSiteFileById(
  database: D1Database,
  request: Request,
  id: string,
): Promise<SiteFileRecord | null> {
  const row = await database.prepare(
    "SELECT * FROM site_files WHERE id = ? LIMIT 1",
  ).bind(id).first<SiteFileRow>();
  return row ? recordFromRow(row, new URL(request.url).origin) : null;
}

export async function getSiteFileByName(
  database: D1Database,
  request: Request,
  filename: string,
): Promise<SiteFileRecord | null> {
  const row = await database.prepare(
    "SELECT * FROM site_files WHERE filename = ? COLLATE NOCASE LIMIT 1",
  ).bind(normalizeSiteFilename(filename)).first<SiteFileRow>();
  return row ? recordFromRow(row, new URL(request.url).origin) : null;
}

export async function createSiteFile(
  database: FeedDb,
  request: Request,
  input: SiteFileInput,
): Promise<SiteFileRecord> {
  const filename = normalizeSiteFilename(input.filename ?? "");
  const filenameError = validateSiteFilename(filename);
  if (filenameError) throw new SiteFileRequestError(filenameError);
  const contentType = validatedMediaType(
    input.content_type ?? siteFileMediaTypeForName(filename),
  );
  const draftContent = String(input.draft_content ?? "");
  const contentError = validateSiteFileContent(draftContent, contentType);
  if (contentError) throw new SiteFileRequestError(contentError);
  const id = randomShortUUID();
  const now = new Date().toISOString();
  try {
    await database.FEED_DB.prepare(`
      INSERT INTO site_files (
        id, filename, mode, draft_content, content_type, enabled,
        created_at, updated_at
      ) VALUES (?, ?, 'override', ?, ?, ?, ?, ?)
    `).bind(
      id,
      filename,
      draftContent,
      contentType,
      input.enabled ? 1 : 0,
      now,
      now,
    ).run();
  } catch (error) {
    if (String(error).toLocaleLowerCase().includes("unique")) {
      throw new SiteFileConflictError(`/${filename} already exists.`);
    }
    throw error;
  }
  await purgeSiteFileCaches(database, id);
  return (await getSiteFileById(database.FEED_DB, request, id))!;
}

export async function updateSiteFile(
  database: FeedDb,
  request: Request,
  id: string,
  input: SiteFileInput,
): Promise<SiteFileRecord | null> {
  const row = await database.FEED_DB.prepare(
    "SELECT * FROM site_files WHERE id = ? LIMIT 1",
  ).bind(id).first() as SiteFileRow | null;
  if (!row) return null;
  if (input.filename !== undefined &&
      normalizeSiteFilename(input.filename) !== row.filename) {
    throw new SiteFileRequestError(
      "Published Site File names are immutable. Create a new file instead.",
    );
  }
  const contentType = input.content_type === undefined
    ? row.content_type
    : validatedMediaType(input.content_type);
  const draftContent = input.draft_content === undefined
    ? row.draft_content
    : String(input.draft_content);
  const contentError = validateSiteFileContent(draftContent, contentType);
  if (contentError) throw new SiteFileRequestError(contentError);
  await database.FEED_DB.prepare(`
    UPDATE site_files SET
      draft_content = ?, content_type = ?, enabled = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    draftContent,
    contentType,
    input.enabled === undefined ? row.enabled : input.enabled ? 1 : 0,
    new Date().toISOString(),
    id,
  ).run();
  await purgeSiteFileCaches(database, id);
  return getSiteFileById(database.FEED_DB, request, id);
}

export async function publishSiteFile(
  database: FeedDb,
  request: Request,
  id: string,
): Promise<SiteFileRecord | null> {
  const row = await database.FEED_DB.prepare(
    "SELECT * FROM site_files WHERE id = ? LIMIT 1",
  ).bind(id).first() as SiteFileRow | null;
  if (!row) return null;
  assertPublishableContent(row.draft_content, row.content_type);
  const now = new Date().toISOString();
  await database.FEED_DB.prepare(`
    UPDATE site_files SET
      mode = 'override', published_content = draft_content,
      published_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(now, now, id).run();
  await purgeSiteFileCaches(database, id);
  return getSiteFileById(database.FEED_DB, request, id);
}

export async function resetSiteFile(
  database: FeedDb,
  request: Request,
  id: string,
): Promise<SiteFileRecord | null> {
  const row = await database.FEED_DB.prepare(
    "SELECT * FROM site_files WHERE id = ? LIMIT 1",
  ).bind(id).first() as SiteFileRow | null;
  if (!row) return null;
  if (!row.generator || !SITE_FILE_GENERATORS.includes(row.generator)) {
    throw new SiteFileRequestError("Only generated Site Files can be reset.");
  }
  const recoverable = row.published_content ?? row.draft_content;
  await database.FEED_DB.prepare(`
    UPDATE site_files SET
      mode = 'generated', draft_content = ?, updated_at = ?
    WHERE id = ?
  `).bind(recoverable, new Date().toISOString(), id).run();
  await purgeSiteFileCaches(database, id);
  return getSiteFileById(database.FEED_DB, request, id);
}

export async function deleteSiteFile(
  database: FeedDb,
  id: string,
): Promise<boolean> {
  const row = await database.FEED_DB.prepare(
    "SELECT generator FROM site_files WHERE id = ? LIMIT 1",
  ).bind(id).first() as {generator: string | null} | null;
  if (!row) return false;
  if (row.generator) {
    throw new SiteFileRequestError("Generated Site Files cannot be deleted.");
  }
  await database.FEED_DB.prepare("DELETE FROM site_files WHERE id = ?")
    .bind(id).run();
  await purgeSiteFileCaches(database, id);
  return true;
}
