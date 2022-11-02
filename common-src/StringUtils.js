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

export function buildAudioUrlWithTracking(audioUrl, trackingUrls, protocal='https') {
  if (!audioUrl) {
    return '';
  }
  if (!trackingUrls || trackingUrls.length === 0) {
    return audioUrl;
  }

  try {
    const protocalRegex = /^https?:\/\//;
    const audioUrlNoProtocal = audioUrl.replace(protocalRegex, '');
    const trackingUrlsNoProtocal = trackingUrls.map(u => u.replace(protocalRegex, ''));

    let finalUrl = `${protocal}://${trackingUrlsNoProtocal[0]}`;
    trackingUrlsNoProtocal.shift();
    trackingUrlsNoProtocal.forEach((u) => {
      const obj = new URL(u, finalUrl);
      finalUrl = obj.href;
    });
    const finalUrlObj = new URL(audioUrlNoProtocal, finalUrl);
    return finalUrlObj.href;
  } catch(e) {
    return audioUrl;
  }
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
  feedRss: (baseUrl='') => {
    return `${baseUrl}/rss/`;
  },
  feedJson: (baseUrl='') => {
    return `${baseUrl}/json/`;
  },
  pageEpisode: (episodeId, episodeTitle, baseUrl='') => {
    if (!episodeTitle) {
      return '';
    }
    return `${baseUrl}/episodes/${slugify(episodeTitle)}-${episodeId}/`;
  }
};
