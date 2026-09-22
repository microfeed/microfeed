import {getIdFromSlug, PUBLIC_URLS} from "./StringUtils";
import {ContentCustomizationError} from "./Seo";

export const ITEM_SLUG_MAX_LENGTH = 120;

export function normalizeItemSlug(value: string): string {
  const slug = value.normalize("NFC").toLowerCase().normalize("NFC");
  if (!slug || Array.from(slug).length > ITEM_SLUG_MAX_LENGTH ||
      !/^[\p{L}\p{N}][\p{L}\p{M}\p{N}-]*$/u.test(slug) || slug.endsWith("-")) {
    throw new ContentCustomizationError(
      "Use up to 120 letters, combining marks, numbers, and hyphens for the item URL. Start with a letter or number and end without a hyphen.",
    );
  }
  return slug;
}

export function automaticItemSlug(title: string): string {
  const slug = Array.from(title.normalize("NFC").toLowerCase().normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^[^\p{L}\p{N}]+|[-]+$/gu, ""))
    .slice(0, ITEM_SLUG_MAX_LENGTH - 12).join("").replace(/-+$/u, "");
  return slug || "untitled";
}

export function legacyItemPath(item: {id?: string; title?: string}): string {
  // Preserve the previous algorithm, including its normalization and case-sensitive ID.
  return PUBLIC_URLS.webItem(item.id ?? "", item.title);
}

export function itemPath(item: {id?: string; title?: string; publicPath?: string}): string {
  return item.publicPath || legacyItemPath(item);
}

export function itemUrl(item: {id?: string; title?: string; publicPath?: string}, base = "/"): string {
  const path = itemPath(item);
  // Encode each segment, preserving Unicode equivalence without double encoding.
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return base === "/" ? encoded : new URL(encoded, base).href;
}

export function decodeItemRoute(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment);
    if (!decoded || /[\x00-\x20\x7f/\\?#%]/u.test(decoded)) return null;
    return decoded;
  } catch { return null; }
}

export function legacyRouteId(path: string): string | null {
  return getIdFromSlug(path.slice(3, -1)) ?? null;
}
