import {ENCLOSURE_CATEGORIES, ENCLOSURE_CATEGORIES_DICT, SUPPORTED_ENCLOSURE_CATEGORIES} from "./Constants";

// Extra web image extensions the ENCLOSURE_CATEGORIES_DICT image list doesn't
// enumerate but the manager should still treat as images.
const EXTRA_IMAGE_EXTENSIONS = ['webp', 'svg', 'avif', 'bmp', 'ico', 'tiff'];

/**
 * Best-effort category for a file, from its name/key or an explicit content
 * type. Returns one of ENCLOSURE_CATEGORIES (image/audio/video/document) or
 * 'other' when nothing matches. Drives the media explorer's grouping/icons.
 */
export function categorizeMedia(nameOrKey, contentType = '') {
  const ct = (contentType || '').toLowerCase();
  if (ct.startsWith('image/')) {
    return ENCLOSURE_CATEGORIES.IMAGE;
  }
  if (ct.startsWith('audio/')) {
    return ENCLOSURE_CATEGORIES.AUDIO;
  }
  if (ct.startsWith('video/')) {
    return ENCLOSURE_CATEGORIES.VIDEO;
  }

  const base = String(nameOrKey || '').split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
  if (!ext) {
    return 'other';
  }
  if (EXTRA_IMAGE_EXTENSIONS.includes(ext)) {
    return ENCLOSURE_CATEGORIES.IMAGE;
  }
  const categories = [
    ENCLOSURE_CATEGORIES.IMAGE,
    ENCLOSURE_CATEGORIES.AUDIO,
    ENCLOSURE_CATEGORIES.VIDEO,
    ENCLOSURE_CATEGORIES.DOCUMENT,
  ];
  for (const category of categories) {
    const def = ENCLOSURE_CATEGORIES_DICT[category];
    if (def && def.fileTypes && def.fileTypes.includes(ext)) {
      return category;
    }
  }
  return 'other';
}

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
