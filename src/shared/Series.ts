export const SERIES_KINDS = {
  POST: "post",
  PODCAST: "podcast",
} as const;

export type SeriesKind = typeof SERIES_KINDS[keyof typeof SERIES_KINDS];

export const SERIES_KIND_VALUES: readonly SeriesKind[] = [
  SERIES_KINDS.POST,
  SERIES_KINDS.PODCAST,
];

export const SERIES_NAME_MAX_LENGTH = 100;
export const SERIES_SLUG_MAX_LENGTH = 100;
export const SERIES_DESCRIPTION_MAX_LENGTH = 500;

export interface SeriesRecord {
  date_created: string;
  date_modified: string;
  description: string | null;
  id: string;
  kind: SeriesKind;
  name: string;
  slug: string;
}

export interface SeriesInput {
  description?: string | null;
  kind?: SeriesKind;
  name?: string;
  slug?: string;
}

export interface ItemSeriesRecord {
  series: SeriesRecord;
  series_number: number | null;
}

export function normalizeSeriesKind(value: unknown): SeriesKind | null {
  return SERIES_KIND_VALUES.includes(value as SeriesKind)
    ? (value as SeriesKind)
    : null;
}

export function normalizeSeriesName(value: string): string {
  return value.trim().replace(/\s+/gu, " ").slice(0, SERIES_NAME_MAX_LENGTH);
}

export function normalizeSeriesSlug(value: string): string {
  return value.trim().toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, SERIES_SLUG_MAX_LENGTH);
}

export function normalizeSeriesDescription(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized.length === 0
    ? null
    : normalized.slice(0, SERIES_DESCRIPTION_MAX_LENGTH);
}

export function seriesSlugFromName(name: string): string {
  return normalizeSeriesSlug(name);
}

export function validateSeriesKind(value: SeriesKind | null): string | null {
  if (!value) return "A series kind (post or podcast) is required.";
  return null;
}

export function validateSeriesName(value: string): string | null {
  if (!value) return "A series name is required.";
  if (value.length > SERIES_NAME_MAX_LENGTH) {
    return `Series names are limited to ${SERIES_NAME_MAX_LENGTH} characters.`;
  }
  return null;
}

export function validateSeriesSlug(value: string): string | null {
  if (!value) return "A series slug is required.";
  if (value.length > SERIES_SLUG_MAX_LENGTH) {
    return `Series slugs are limited to ${SERIES_SLUG_MAX_LENGTH} characters.`;
  }
  return null;
}

export function validateSeriesDescription(
  value: string | null | undefined,
): string | null {
  if (value && value.length > SERIES_DESCRIPTION_MAX_LENGTH) {
    return `Series descriptions are limited to ${SERIES_DESCRIPTION_MAX_LENGTH} characters.`;
  }
  return null;
}

export function normalizeSeriesNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 1 ? number : null;
}
