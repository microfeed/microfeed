export const MEDIA_LIBRARY_FILENAME_MAX_LENGTH = 255;
export const MEDIA_LIBRARY_URL_MAX_LENGTH = 2048;
export const MEDIA_LIBRARY_OBJECT_KEY_MAX_LENGTH = 1024;

export interface MediaLibraryRecord {
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

export interface MediaLibraryInput {
  content_type?: string | null;
  filename?: string;
  format?: string | null;
  height?: number | null;
  object_key: string;
  size_bytes?: number | null;
  url: string;
  width?: number | null;
}

export function normalizeMediaLibraryFilename(value: string): string {
  return value.trim().slice(0, MEDIA_LIBRARY_FILENAME_MAX_LENGTH);
}

export function normalizeMediaLibraryUrl(value: string): string {
  return value.trim().slice(0, MEDIA_LIBRARY_URL_MAX_LENGTH);
}

export function normalizeMediaLibraryObjectKey(value: string): string {
  return value.trim().slice(0, MEDIA_LIBRARY_OBJECT_KEY_MAX_LENGTH);
}

export function validateMediaLibraryObjectKey(value: string): string | null {
  if (!value) return "A media object key is required.";
  if (value.length > MEDIA_LIBRARY_OBJECT_KEY_MAX_LENGTH) {
    return `Media object keys are limited to ${MEDIA_LIBRARY_OBJECT_KEY_MAX_LENGTH} characters.`;
  }
  return null;
}

export function validateMediaLibraryUrl(value: string): string | null {
  if (!value) return "A media URL is required.";
  if (value.length > MEDIA_LIBRARY_URL_MAX_LENGTH) {
    return `Media URLs are limited to ${MEDIA_LIBRARY_URL_MAX_LENGTH} characters.`;
  }
  return null;
}

export function validateMediaLibraryFilename(value: string): string | null {
  if (!value) return "A media filename is required.";
  if (value.length > MEDIA_LIBRARY_FILENAME_MAX_LENGTH) {
    return `Media filenames are limited to ${MEDIA_LIBRARY_FILENAME_MAX_LENGTH} characters.`;
  }
  return null;
}

export function mediaFormatFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const normalized = contentType.toLowerCase();
  if (normalized.includes("avif")) return "avif";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpeg";
  if (normalized.includes("gif")) return "gif";
  return null;
}
