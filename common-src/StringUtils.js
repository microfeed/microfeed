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

/**
 * Admin urls
 */
const ADMIN_HOME = '/admin';

export const ADMIN_URLS = {
  home: () => ADMIN_HOME,
  pageEditEpisode: (episodeId) => `${ADMIN_HOME}/episodes/${episodeId}/`,
  ajaxFeed: () => `${ADMIN_HOME}/ajax/feed/`,
};
