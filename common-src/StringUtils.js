const slugify = require('slugify')

export function randomHex(size = 32) {
  return [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

export function randomShortUUID(length = 11) {
  const asciiLowercase = 'abcdefghijklmnopqrstuvwxyz';
  const asciiUppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const allChars = asciiLowercase + asciiUppercase + digits + '_-';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  return result;
}

export function humanFileSize(size) {
    const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

/**
 * Admin urls
 */
const ADMIN_HOME = '/admin';

export const ADMIN_URLS = {
  home: () => ADMIN_HOME,
  pageEditEpisode: (episodeId) => `${ADMIN_HOME}/episodes/${episodeId}/`,
  ajaxFeed: () => `${ADMIN_HOME}/ajax/feed/`,
};

/**
 * Public urls
 */
export const PUBLIC_URLS = {
  pageEpisode: (episodeId, episodeTitle) => {
    if (!episodeTitle) {
      return '';
    }
    return `/episodes/${slugify(episodeTitle)}-${episodeId}/`;
  }
};
