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

export function secondsToHHMMSS(secs) {
  if (!secs) {
    return '00:00:00';
  }
  const secNum = parseInt(secs, 10)
  const hours = Math.floor(secNum / 3600)
  const minutes = Math.floor(secNum / 60) % 60
  const seconds = secNum % 60

  return [hours, minutes, seconds]
    .map(v => v < 10 ? '0' + v : v)
    .join(":")
}

export function humanFileSize(size) {
    const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

function normalize (strArray) {
  const resultArray = [];
  if (strArray.length === 0) { return ''; }

  if (typeof strArray[0] !== 'string') {
    throw new TypeError('Url must be a string. Received ' + strArray[0]);
  }

  // If the first part is a plain protocol, we combine it with the next part.
  if (strArray[0].match(/^[^/:]+:\/*$/) && strArray.length > 1) {
    strArray[0] = strArray.shift() + strArray[0];
  }

  // There must be two or three slashes in the file protocol, two slashes in anything else.
  if (strArray[0].match(/^file:\/\/\//)) {
    strArray[0] = strArray[0].replace(/^([^/:]+):\/*/, '$1:///');
  } else {
    strArray[0] = strArray[0].replace(/^([^/:]+):\/*/, '$1://');
  }

  for (let i = 0; i < strArray.length; i++) {
    let component = strArray[i];

    if (typeof component !== 'string') {
      throw new TypeError('Url must be a string. Received ' + component);
    }

    if (component === '') { continue; }

    if (i > 0) {
      // Removing the starting slashes for each component but the first.
      component = component.replace(/^[\/]+/, '');
    }
    if (i < strArray.length - 1) {
      // Removing the ending slashes for each component but the last.
      component = component.replace(/[\/]+$/, '');
    } else {
      // For the last component we will combine multiple slashes to a single one.
      component = component.replace(/[\/]+$/, '/');
    }

    resultArray.push(component);

  }

  let str = resultArray.join('/');
  // Each input component is now separated by a single slash except the possible first plain protocol part.

  // remove trailing slash before parameters or hash
  str = str.replace(/\/(\?|&|#[^!])/g, '$1');

  // replace ? in parameters with &
  const parts = str.split('?');
  str = parts.shift() + (parts.length > 0 ? '?': '') + parts.join('&');

  return str;
}

export default function urlJoin(...args) {
  const parts = Array.from(Array.isArray(args[0]) ? args[0] : args);
  return normalize(parts);
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
    return urlJoin(finalUrl, ...trackingUrlsNoProtocal, audioUrlNoProtocal);
    // trackingUrlsNoProtocal.forEach((u) => {
    //   const obj = new URL(u, finalUrl);
    //   finalUrl = obj.href;
    // });
    // const finalUrlObj = new URL(audioUrlNoProtocal, finalUrl);
    // return finalUrlObj.href;
  } catch(e) {
    return audioUrl;
  }
}

export function escapeHtml(htmlStr) {
  return htmlStr.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function unescapeHtml(htmlStr) {
  htmlStr = htmlStr.replace(/&lt;/g, "<");
  htmlStr = htmlStr.replace(/&gt;/g, ">");
  htmlStr = htmlStr.replace(/&quot;/g, "\"");
  htmlStr = htmlStr.replace(/&#39;/g, "'");
  htmlStr = htmlStr.replace(/&amp;/g, "&");
  return htmlStr;
}

/**
 * Admin urls
 */
const ADMIN_HOME = '/admin';

export const ADMIN_URLS = {
  home: () => `${ADMIN_HOME}/`,
  editItem: (itemId) => `${ADMIN_HOME}/items/${itemId}/`,
  newItem: () => `${ADMIN_HOME}/items/new/`,
  allItems: () => `${ADMIN_HOME}/items/`,
  settings: () => `${ADMIN_HOME}/settings/`,
  sylingSettings: () => `${ADMIN_HOME}/settings/styling/`,
  logout: () => `${ADMIN_HOME}/logout/`,

  ajaxFeed: () => `${ADMIN_HOME}/ajax/feed/`,
};

/**
 * Public urls
 */
export const PUBLIC_URLS = {
  feedWeb: (baseUrl = '') => {
    return `${baseUrl}/`;
  },
  feedRss: (baseUrl='') => {
    return `${baseUrl}/rss/`;
  },
  feedRssStylesheet: (baseUrl='') => {
    return `${baseUrl}/rss/stylesheet/`;
  },
  feedJson: (baseUrl='') => {
    return `${baseUrl}/json/`;
  },
  itemWeb: (itemId, itemTitle, baseUrl='') => {
    return `${baseUrl}/i/${slugify(itemTitle || '')}-${itemId}/`;
  }
};
