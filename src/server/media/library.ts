import {
  mediaFormatFromContentType,
  normalizeMediaLibraryFilename,
  normalizeMediaLibraryObjectKey,
  normalizeMediaLibraryUrl,
  type MediaLibraryInput,
  type MediaLibraryRecord,
  validateMediaLibraryFilename,
  validateMediaLibraryObjectKey,
  validateMediaLibraryUrl,
} from "@/shared/MediaLibrary";
import {randomShortUUID} from "@/shared/StringUtils";

export class MediaLibraryRequestError extends Error {}

interface MediaLibraryRow extends Record<string, unknown> {
  content_type: string | null;
  created_at: string;
  filename: string;
  format: string | null;
  height: number | null;
  id: string;
  object_key: string;
  size_bytes: number | null;
  url: string;
  width: number | null;
}

function recordFromRow(row: MediaLibraryRow): MediaLibraryRecord {
  return {
    content_type: row.content_type === null ? null : String(row.content_type),
    created_at: String(row.created_at),
    filename: String(row.filename),
    format: row.format === null ? null : String(row.format),
    height: row.height === null ? null : Number(row.height),
    id: String(row.id),
    object_key: String(row.object_key),
    size_bytes: row.size_bytes === null ? null : Number(row.size_bytes),
    url: String(row.url),
    width: row.width === null ? null : Number(row.width),
  };
}

function validatedInput(input: MediaLibraryInput): {
  content_type: string | null;
  filename: string;
  format: string | null;
  height: number | null;
  object_key: string;
  size_bytes: number | null;
  url: string;
  width: number | null;
} {
  const objectKey = normalizeMediaLibraryObjectKey(input.object_key);
  const objectKeyError = validateMediaLibraryObjectKey(objectKey);
  if (objectKeyError) throw new MediaLibraryRequestError(objectKeyError);
  const url = normalizeMediaLibraryUrl(input.url);
  const urlError = validateMediaLibraryUrl(url);
  if (urlError) throw new MediaLibraryRequestError(urlError);
  const filename = normalizeMediaLibraryFilename(input.filename ?? "");
  const filenameError = validateMediaLibraryFilename(filename);
  if (filenameError) throw new MediaLibraryRequestError(filenameError);
  const content_type = input.content_type?.trim() || null;
  return {
    content_type,
    filename,
    format: input.format?.trim() || mediaFormatFromContentType(content_type),
    height: input.height === null || input.height === undefined
      ? null
      : Math.max(0, Math.floor(Number(input.height))),
    object_key: objectKey,
    size_bytes: input.size_bytes === null || input.size_bytes === undefined
      ? null
      : Math.max(0, Math.floor(Number(input.size_bytes))),
    url,
    width: input.width === null || input.width === undefined
      ? null
      : Math.max(0, Math.floor(Number(input.width))),
  };
}

/**
 * Records a completed upload in the media library. The object key is unique:
 * re-uploading to the same key updates the existing record instead of
 * creating a duplicate.
 */
export async function recordUploadedMedia(
  database: D1Database,
  input: MediaLibraryInput,
): Promise<MediaLibraryRecord> {
  const validated = validatedInput(input);
  const existing = await mediaLibraryEntryByObjectKey(
    database,
    validated.object_key,
  );
  const now = new Date().toISOString();
  if (existing) {
    await database.prepare(`
      UPDATE media_library
      SET url = ?, filename = ?, content_type = ?, size_bytes = ?,
        width = ?, height = ?, format = ?, created_at = ?
      WHERE id = ?
    `).bind(
      validated.url,
      validated.filename,
      validated.content_type,
      validated.size_bytes,
      validated.width,
      validated.height,
      validated.format,
      now,
      existing.id,
    ).run();
    return {
      ...existing,
      ...validated,
      created_at: now,
    };
  }
  const id = randomShortUUID();
  await database.prepare(`
    INSERT INTO media_library (
      id, object_key, url, filename, content_type, size_bytes,
      width, height, format, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    validated.object_key,
    validated.url,
    validated.filename,
    validated.content_type,
    validated.size_bytes,
    validated.width,
    validated.height,
    validated.format,
    now,
  ).run();
  return {
    content_type: validated.content_type,
    created_at: now,
    filename: validated.filename,
    format: validated.format,
    height: validated.height,
    id,
    object_key: validated.object_key,
    size_bytes: validated.size_bytes,
    url: validated.url,
    width: validated.width,
  };
}

export async function listMediaLibrary(
  database: D1Database,
): Promise<MediaLibraryRecord[]> {
  const result = await database.prepare(`
    SELECT * FROM media_library
    ORDER BY created_at DESC, id
  `).all();
  return result.results.map((row) => recordFromRow(row as MediaLibraryRow));
}

export async function getMediaLibraryEntry(
  database: D1Database,
  id: string,
): Promise<MediaLibraryRecord | null> {
  const row = await database.prepare(
    "SELECT * FROM media_library WHERE id = ? LIMIT 1",
  ).bind(id).first<MediaLibraryRow>();
  return row ? recordFromRow(row) : null;
}

export async function mediaLibraryEntryByObjectKey(
  database: D1Database,
  objectKey: string,
): Promise<MediaLibraryRecord | null> {
  const row = await database.prepare(
    "SELECT * FROM media_library WHERE object_key = ? LIMIT 1",
  ).bind(objectKey).first<MediaLibraryRow>();
  return row ? recordFromRow(row) : null;
}

/**
 * Deletes the library record. Returns the deleted record so the caller can
 * also remove the underlying R2 object.
 */
export async function deleteMediaLibraryEntry(
  database: D1Database,
  id: string,
): Promise<MediaLibraryRecord | null> {
  const existing = await getMediaLibraryEntry(database, id);
  if (!existing) return null;
  await database.prepare(
    "DELETE FROM media_library WHERE id = ?",
  ).bind(id).run();
  return existing;
}
