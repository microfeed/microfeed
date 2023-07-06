import {
  ENCLOSURE_CATEGORIES,
  SUPPORTED_ENCLOSURE_CATEGORIES
} from "./Constants";

export function isValidMediaFile(mediaFile) {
  return mediaFile && mediaFile.category && mediaFile.url && mediaFile.url.trim();
}

export function getMediaFileFromUrl(urlParams) {
  const category = urlParams.get('media_category');

  const mediaFile = {};

  const url = urlParams.get('media_url');
  if (url) {
    mediaFile.url = url;
  }

  if (category) {
    mediaFile.category = SUPPORTED_ENCLOSURE_CATEGORIES.includes(category) ? category : null;

    // TODO: dynamically fetch content type by sending HEAD request
    if (mediaFile.category === ENCLOSURE_CATEGORIES.EXTERNAL_URL) {
      mediaFile.contentType = 'text/html';
    }
  }
  return mediaFile;
}
``
