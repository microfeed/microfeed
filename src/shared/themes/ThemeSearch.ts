import {
  DEFAULT_THEME_SEARCH_ITEM_DESTINATION,
  type ThemeManifestV1,
  type ThemeSearchItemDestination,
} from "./ThemeContract";

interface ThemeSearchItemUrls {
  attachmentUrl?: string;
  itemUrl?: string;
  webUrl: string;
}

export function manifestSearchItemDestination(
  manifest: ThemeManifestV1 | null | undefined,
): ThemeSearchItemDestination {
  return manifest?.formatVersion === 2
    ? manifest.searchItemDestination ?? DEFAULT_THEME_SEARCH_ITEM_DESTINATION
    : DEFAULT_THEME_SEARCH_ITEM_DESTINATION;
}

export function resolveThemeSearchItemUrl(
  destination: ThemeSearchItemDestination,
  {attachmentUrl, itemUrl, webUrl}: ThemeSearchItemUrls,
): string {
  if (destination === "url" && itemUrl) return itemUrl;
  if (destination === "attachment" && attachmentUrl) return attachmentUrl;
  return webUrl;
}
