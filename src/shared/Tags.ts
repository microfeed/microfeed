export const TAG_NAME_MAX_LENGTH = 50;
export const TAG_SLUG_MAX_LENGTH = 100;
export const TAG_NAME_LENGTH_ERROR = "Tag name must be 50 characters or fewer.";

export interface TagRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  date_created: string;
  date_modified: string;
  published_item_count: number;
  url: string;
  rss_url: string;
  json_url: string;
}

export function normalizeTagName(value: string): string {
  return value.trim().normalize("NFC");
}

export function tagNameError(value: string): string | undefined {
  const name = normalizeTagName(value);
  if (!name) return "Enter a tag name.";
  if (Array.from(name).length > TAG_NAME_MAX_LENGTH) return TAG_NAME_LENGTH_ERROR;
  if (/[\p{Cc}]/u.test(name)) return "Tag names cannot contain control characters.";
  return undefined;
}

export function normalizedTagKey(value: string): string {
  return normalizeTagName(value).toLowerCase().normalize("NFC");
}

export function normalizeTagSlug(value: string): string {
  return value.trim().normalize("NFC").toLowerCase().normalize("NFC");
}

export function tagSlugError(value: string): string | undefined {
  const slug = normalizeTagSlug(value);
  if (!slug || Array.from(slug).length > TAG_SLUG_MAX_LENGTH ||
      !/^[\p{L}\p{N}][\p{L}\p{M}\p{N}-]*$/u.test(slug) || slug.endsWith("-")) {
    return "Use a tag slug of 100 characters or fewer, with letters, numbers, and hyphens.";
  }
  return undefined;
}

export function automaticTagSlug(name: string): string {
  return normalizeTagSlug(name).replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^[^\p{L}\p{N}]+|-+$/gu, "") || "tag";
}

export function tagUrls(slug: string, origin: string) {
  const url = new URL(`/tags/${encodeURIComponent(slug)}/`, origin).href;
  return {url, rss_url: `${url}rss/`, json_url: `${url}json/`};
}

export class TagRequestError extends Error {
  constructor(message: string, public readonly field = "tags") { super(message); }
}
export class TagConflictError extends Error {}
