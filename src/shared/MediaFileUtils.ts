import {ENCLOSURE_CATEGORIES, SUPPORTED_ENCLOSURE_CATEGORIES} from "./Constants";

export function isValidMediaFile(mediaFile: any) {
  return mediaFile && mediaFile.category && mediaFile.url && mediaFile.url.trim();
}

export function getMediaFileFromUrl(urlParams: any) {
  const category = urlParams.get('media_category');

  const mediaFile = {};

  const url = urlParams.get('media_url');
  if (url) {
    (mediaFile as any).url = url;
  }

  if (category) {
    (mediaFile as any).category = SUPPORTED_ENCLOSURE_CATEGORIES.includes(category) ? category : null;

    // TODO: dynamically fetch content type by sending HEAD request
    if ((mediaFile as any).category === ENCLOSURE_CATEGORIES.EXTERNAL_URL) {
      (mediaFile as any).contentType = 'text/html';
    }
  }
  return mediaFile;
}
