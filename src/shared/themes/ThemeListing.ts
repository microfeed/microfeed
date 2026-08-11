import {
  THEME_LIST_SORTS,
  THEME_SEARCH_MAX_LENGTH,
  type ThemeListSort,
  type ThemeListOptions,
} from "./ThemeContract";

export function parseThemeListOptions(
  searchParams: URLSearchParams,
): ThemeListOptions {
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length > THEME_SEARCH_MAX_LENGTH) {
    throw new Error(`Theme search is limited to ${THEME_SEARCH_MAX_LENGTH} characters.`);
  }
  const requestedSort = searchParams.get("sort") ?? "status";
  const sort = THEME_LIST_SORTS.includes(requestedSort as ThemeListSort)
    ? requestedSort as ThemeListSort
    : null;
  if (!sort) throw new Error("Unknown theme sort order.");
  const requestedPage = searchParams.get("page") ?? "1";
  if (!/^\d+$/u.test(requestedPage) || Number(requestedPage) < 1) {
    throw new Error("Theme page must be a positive integer.");
  }
  return {page: Number(requestedPage), q, sort};
}
