export const MAX_CATEGORIES_PER_ITEM = 2;

export const CATEGORY_NAME_MAX_LENGTH = 100;
export const CATEGORY_SLUG_MAX_LENGTH = 100;

export interface CategoryRecord {
  date_created: string;
  date_modified: string;
  id: string;
  name: string;
  slug: string;
}

export interface CategoryInput {
  name?: string;
  slug?: string;
}

export function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/gu, " ").slice(0, CATEGORY_NAME_MAX_LENGTH);
}

export function normalizeCategorySlug(value: string): string {
  return value.trim().toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, CATEGORY_SLUG_MAX_LENGTH);
}

export function categorySlugFromName(name: string): string {
  return normalizeCategorySlug(name);
}

export function validateCategoryName(value: string): string | null {
  if (!value) return "A category name is required.";
  if (value.length > CATEGORY_NAME_MAX_LENGTH) {
    return `Category names are limited to ${CATEGORY_NAME_MAX_LENGTH} characters.`;
  }
  return null;
}

export function validateCategorySlug(value: string): string | null {
  if (!value) return "A category slug is required.";
  if (value.length > CATEGORY_SLUG_MAX_LENGTH) {
    return `Category slugs are limited to ${CATEGORY_SLUG_MAX_LENGTH} characters.`;
  }
  return null;
}
