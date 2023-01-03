import {convert} from "html-to-text";

const slugify = require('slugify')

export function randomHex(size = 32) {
  return [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

export function isValidUrl(url) {
  let theUrl;
  try {
    theUrl = new URL(url);
  } catch (_) {
    return false;
  }

  return theUrl.protocol === 'http:' || theUrl.protocol === 'https:';
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

export function urlJoin(...args) {
  const parts = Array.from(Array.isArray(args[0]) ? args[0] : args);
  return normalize(parts);
}

/**
 * Path could be:
 * 1) Relative url to website, e.g., /assets/default/something.png, or
 * 2) Relative url to cdn (r2), e.g., production/something.png
 */
export function urlJoinWithRelative(baseUrl, path, baseUrlForRelativePath = '/') {
  if (!path) {
    return null;
  }

  if (path.startsWith('/')) {
    return urlJoin(baseUrlForRelativePath, path);
  }
  if (baseUrl) {
    return urlJoin(baseUrl, path);
  }
  return urlJoin('/', path);
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

export function getIdFromSlug(slug) {
  let itemId
  let re = /^.*-([\d\w\-_]{11})$/;
  let ok = re.exec(slug);
  if (ok) {
    itemId = ok[1];
  } else {
    re = /^([\d\w\-_]{11})$/;
    ok = re.exec(slug);
    if (ok) {
      itemId = ok[1];
    }
  }
  return itemId;
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

export function htmlToPlainText(htmlStr, options = null) {
  let convertOptions = {
    ignoreHref: true,
  };
  if (options) {
    convertOptions = {
      ...convertOptions,
      ...options,
    }
  }
  return convert(htmlStr || '', convertOptions);
}

export function truncateString(str, num, ellipsis = true) {
  if (str.length > num) {
    return `${str.slice(0, num)}${ellipsis ? '...' : ''}`;
  } else {
    return str;
  }
}

export function htmlMetaDescription(str, isHtml = true) {
  const text = isHtml ? htmlToPlainText(str) : str;
  // https://moz.com/learn/seo/meta-description
  return truncateString(text, 155);
}

/**
 * Admin urls
 */
const ADMIN_HOME = '/admin';

export const ADMIN_URLS = {
  home: (baseUrl = '/') => urlJoin(baseUrl, `${ADMIN_HOME}/`),
  editPrimaryChannel: () => `${ADMIN_HOME}/channels/primary/`,
  editItem: (itemId) => `${ADMIN_HOME}/items/${itemId}/`,
  newItem: (baseUrl = '/') => urlJoin(baseUrl, `${ADMIN_HOME}/items/new/`),
  allItems: () => `${ADMIN_HOME}/items/list/`,
  settings: () => `${ADMIN_HOME}/settings/`,
  codeEditorSettings: () => `${ADMIN_HOME}/settings/code-editor/`,
  logout: () => '/cdn-cgi/access/logout',

  ajaxFeed: () => `${ADMIN_HOME}/ajax/feed/`,
};

/**
 * Public urls
 */
function webItem(itemId, itemTitle = null, baseUrl = '/', locale = 'en') {
  if (itemTitle) {
    const title = truncateString(itemTitle, 50, false);
    let slug = slugify(title, {
      lower: true,
      strict: true, // strip special characters except replacement
      locale,
    });
    // Fallback to a custom implementation to deal with all non-English characters.
    if (!slug) {
      slug = title
        .toString()
        .normalize('NFKD')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/\_/g, '-')
        .replace(/\-\-+/g, '-')
        .replace(/\-$/g, '');
    }
    return urlJoin(baseUrl, `/i/${slug}-${itemId}/`);
  } else {
    return urlJoin(baseUrl, `/i/${itemId}/`);
  }
}

export const PUBLIC_URLS = {
  webFeed: (baseUrl = '/') => {
    return urlJoin(baseUrl, '/');
  },
  rssFeed: (baseUrl='/') => {
    return urlJoin(baseUrl, '/rss/');
  },
  rssFeedStylesheet: (baseUrl='/') => {
    return urlJoin(baseUrl, '/rss/stylesheet/');
  },
  jsonFeed: (baseUrl='/') => {
    return urlJoin(baseUrl, 'json/');
  },
  webItem,
  jsonItem: (itemId, itemTitle = null, baseUrl = '/', locale = 'en') => {
    return urlJoin(webItem(itemId, itemTitle, baseUrl, locale), 'json/');
  },
  rssItem: (itemId, itemTitle = null, baseUrl = '/', locale = 'en') => {
    return urlJoin(webItem(itemId, itemTitle, baseUrl, locale), 'rss/');
  },
};
