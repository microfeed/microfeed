export const LEGACY_DEFAULT_FAVICON_URL = "/assets/default/favicon.png";

export interface FaviconImage {
  contentType?: string;
  url?: string;
}

export function hasUploadedFavicon(
  favicon: FaviconImage | undefined,
): boolean {
  const faviconUrl = favicon?.url?.trim();
  return Boolean(faviconUrl && faviconUrl !== LEGACY_DEFAULT_FAVICON_URL);
}

/**
 * Uses an uploaded favicon when one exists, otherwise falls back to the
 * channel image. Older sites store microfeed's default favicon in settings;
 * that asset represents the pre-upload state rather than a user choice.
 */
export function resolveEffectiveFavicon(
  favicon: FaviconImage | undefined,
  channelImage: unknown,
): FaviconImage | undefined {
  const faviconUrl = favicon?.url?.trim();
  if (hasUploadedFavicon(favicon)) {
    return {
      contentType: favicon?.contentType,
      url: faviconUrl,
    };
  }

  const channelImageUrl = typeof channelImage === "string"
    ? channelImage.trim()
    : "";
  if (channelImageUrl) {
    return {url: channelImageUrl};
  }

  return faviconUrl
    ? {
        contentType: favicon?.contentType,
        url: faviconUrl,
      }
    : undefined;
}
