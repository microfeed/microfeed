import {
  normalizeSiteFilename,
  publicSiteFilePath,
  type SiteFileGenerator,
  type SiteFileMediaType,
  type SiteFileRecord,
  SITE_FILE_GENERATORS,
  SITE_FILE_MEDIA_TYPES,
  siteFileMediaTypeForName,
  validateSiteFilename,
} from "@/shared/SiteFiles";
import type {AdminSiteFileSummary} from "@/shared/AdminCollections";
import {
  defaultSiteFileTemplate,
  validateSiteFileTemplateSource,
} from "@/shared/SiteFileTemplates";
import {randomShortUUID} from "@/shared/StringUtils";
import type FeedDb from "@/server/feed/FeedDb";
import {PUBLIC_CACHE_TAGS} from "@/server/cache/public-cache";
import {renderSiteFileForRequest} from "./templates";
import {
  commitDatabaseMutation,
  type DatabaseMutationCommit,
} from "@/server/mutation";

export interface SiteFileInput {
  content_type?: SiteFileMediaType;
  draft_content?: string;
  enabled?: boolean;
  filename?: string;
}

export interface SiteFilePreviewInput extends SiteFileInput {
  site_file_id?: string;
}

export interface SiteFilePreview {
  content_type: SiteFileMediaType;
  rendered_content: string;
  valid: true;
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
  published_rendered_content: string | null;
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
    draft_content: row.mode === "generated" && !row.draft_content
      ? defaultSiteFileTemplate(row.generator ?? undefined) ?? ""
      : String(row.draft_content ?? ""),
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

function assertValidTemplateSource(content: string): void {
  const error = validateSiteFileTemplateSource(content);
  if (error) throw new SiteFileRequestError(error);
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

export async function listAdminSiteFileSummaries(
  database: D1Database,
): Promise<AdminSiteFileSummary[]> {
  const result = await database.prepare(`
    SELECT id, filename, content_type, enabled
    FROM site_files
    ORDER BY generator IS NULL, filename COLLATE NOCASE, id
  `).all<{
    content_type: SiteFileMediaType;
    enabled: number;
    filename: string;
    id: string;
  }>();
  return result.results.map((row) => ({
    content_type: row.content_type,
    enabled: Boolean(row.enabled),
    filename: String(row.filename),
    id: String(row.id),
  }));
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

export async function getRuntimeSiteFileByName(
  database: D1Database,
  request: Request,
  filename: string,
): Promise<{
  publishedRenderedContent?: string;
  siteFile: SiteFileRecord;
} | null> {
  const row = await database.prepare(
    "SELECT * FROM site_files WHERE filename = ? COLLATE NOCASE LIMIT 1",
  ).bind(normalizeSiteFilename(filename)).first<SiteFileRow>();
  return row
    ? {
        ...(row.published_rendered_content !== null
          ? {publishedRenderedContent: String(row.published_rendered_content)}
          : {}),
        siteFile: recordFromRow(row, new URL(request.url).origin),
      }
    : null;
}

export async function createSiteFile(
  database: FeedDb,
  request: Request,
  input: SiteFileInput,
  commit?: DatabaseMutationCommit<SiteFileRecord>,
): Promise<SiteFileRecord> {
  const filename = normalizeSiteFilename(input.filename ?? "");
  const filenameError = validateSiteFilename(filename);
  if (filenameError) throw new SiteFileRequestError(filenameError);
  const contentType = validatedMediaType(
    input.content_type ?? siteFileMediaTypeForName(filename),
  );
  const draftContent = String(input.draft_content ?? "");
  assertValidTemplateSource(draftContent);
  const id = randomShortUUID();
  const now = new Date().toISOString();
  const siteFile = recordFromRow({
    content_type: contentType,
    created_at: now,
    draft_content: draftContent,
    enabled: input.enabled ? 1 : 0,
    filename,
    generator: null,
    id,
    mode: "override",
    published_at: null,
    published_content: null,
    published_rendered_content: null,
    updated_at: now,
  }, new URL(request.url).origin);
  try {
    const statement = database.FEED_DB.prepare(`
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
    );
    await commitDatabaseMutation(
      database.FEED_DB,
      [statement],
      siteFile,
      commit,
    );
  } catch (error) {
    if (String(error).toLocaleLowerCase().includes("unique")) {
      throw new SiteFileConflictError(`/${filename} already exists.`);
    }
    throw error;
  }
  await purgeSiteFileCaches(database, id);
  return siteFile;
}

export async function updateSiteFile(
  database: FeedDb,
  request: Request,
  id: string,
  input: SiteFileInput,
  commit?: DatabaseMutationCommit<SiteFileRecord>,
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
  assertValidTemplateSource(draftContent);
  const now = new Date().toISOString();
  const enabled = input.enabled === undefined
    ? row.enabled
    : input.enabled ? 1 : 0;
  const siteFile = recordFromRow({
    ...row,
    content_type: contentType,
    draft_content: draftContent,
    enabled,
    updated_at: now,
  }, new URL(request.url).origin);
  const statement = database.FEED_DB.prepare(`
    UPDATE site_files SET
      draft_content = ?, content_type = ?, enabled = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    draftContent,
    contentType,
    enabled,
    now,
    id,
  );
  await commitDatabaseMutation(database.FEED_DB, [statement], siteFile, commit);
  await purgeSiteFileCaches(database, id);
  return siteFile;
}

export async function publishSiteFile(
  database: FeedDb,
  request: Request,
  id: string,
  commit?: DatabaseMutationCommit<SiteFileRecord>,
): Promise<SiteFileRecord | null> {
  const row = await database.FEED_DB.prepare(
    "SELECT * FROM site_files WHERE id = ? LIMIT 1",
  ).bind(id).first() as SiteFileRow | null;
  if (!row) return null;
  const template = row.draft_content ||
    defaultSiteFileTemplate(row.generator ?? undefined) || "";
  assertValidTemplateSource(template);
  let renderedContent: string;
  try {
    renderedContent = (await renderSiteFileForRequest(database, request, {
      contentType: row.content_type,
      filename: row.filename,
      ...(row.generator ? {generator: row.generator} : {}),
      template,
    })).content;
  } catch (error) {
    throw new SiteFileRequestError(
      error instanceof Error ? error.message : String(error),
    );
  }
  const now = new Date().toISOString();
  const siteFile = recordFromRow({
    ...row,
    mode: "override",
    published_at: now,
    published_content: template,
    published_rendered_content: renderedContent,
    updated_at: now,
  }, new URL(request.url).origin);
  const statement = database.FEED_DB.prepare(`
    UPDATE site_files SET
      mode = 'override', published_content = ?,
      published_rendered_content = ?,
      published_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(template, renderedContent, now, now, id);
  await commitDatabaseMutation(database.FEED_DB, [statement], siteFile, commit);
  await purgeSiteFileCaches(database, id);
  return siteFile;
}

export async function resetSiteFile(
  database: FeedDb,
  request: Request,
  id: string,
  commit?: DatabaseMutationCommit<SiteFileRecord>,
): Promise<SiteFileRecord | null> {
  const row = await database.FEED_DB.prepare(
    "SELECT * FROM site_files WHERE id = ? LIMIT 1",
  ).bind(id).first() as SiteFileRow | null;
  if (!row) return null;
  if (!row.generator || !SITE_FILE_GENERATORS.includes(row.generator)) {
    throw new SiteFileRequestError("Only generated Site Files can be reset.");
  }
  const now = new Date().toISOString();
  const siteFile = recordFromRow({
    ...row,
    draft_content: "",
    mode: "generated",
    published_at: null,
    published_content: null,
    published_rendered_content: null,
    updated_at: now,
  }, new URL(request.url).origin);
  const statement = database.FEED_DB.prepare(`
    UPDATE site_files SET
      mode = 'generated', draft_content = '', published_content = NULL,
      published_rendered_content = NULL, published_at = NULL, updated_at = ?
    WHERE id = ?
  `).bind(now, id);
  await commitDatabaseMutation(database.FEED_DB, [statement], siteFile, commit);
  await purgeSiteFileCaches(database, id);
  return siteFile;
}

export async function previewSiteFile(
  database: FeedDb,
  request: Request,
  input: SiteFilePreviewInput,
): Promise<SiteFilePreview | null> {
  const row = input.site_file_id
    ? await database.FEED_DB.prepare(
        "SELECT * FROM site_files WHERE id = ? LIMIT 1",
      ).bind(input.site_file_id).first() as SiteFileRow | null
    : null;
  if (input.site_file_id && !row) return null;
  const filename = normalizeSiteFilename(input.filename ?? row?.filename ?? "");
  const filenameError = validateSiteFilename(filename);
  if (filenameError) throw new SiteFileRequestError(filenameError);
  const contentType = validatedMediaType(
    input.content_type ?? row?.content_type ?? siteFileMediaTypeForName(filename),
  );
  const template = String(
    input.draft_content ?? row?.draft_content ??
      defaultSiteFileTemplate(row?.generator ?? undefined) ?? "",
  );
  assertValidTemplateSource(template);
  try {
    const rendered = await renderSiteFileForRequest(database, request, {
      allowLargeGeneratedSitemap: row?.generator === "sitemap" &&
        row.mode === "generated" &&
        template === defaultSiteFileTemplate("sitemap"),
      contentType,
      filename,
      ...(row?.generator ? {generator: row.generator} : {}),
      template,
    });
    return {
      content_type: contentType,
      rendered_content: rendered.content,
      valid: true,
    };
  } catch (error) {
    throw new SiteFileRequestError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function deleteSiteFile(
  database: FeedDb,
  id: string,
  commit?: DatabaseMutationCommit<boolean>,
): Promise<boolean> {
  const row = await database.FEED_DB.prepare(
    "SELECT generator FROM site_files WHERE id = ? LIMIT 1",
  ).bind(id).first() as {generator: string | null} | null;
  if (!row) return false;
  if (row.generator) {
    throw new SiteFileRequestError("Generated Site Files cannot be deleted.");
  }
  const statement = database.FEED_DB.prepare(
    "DELETE FROM site_files WHERE id = ?",
  ).bind(id);
  await commitDatabaseMutation(database.FEED_DB, [statement], true, commit);
  await purgeSiteFileCaches(database, id);
  return true;
}
