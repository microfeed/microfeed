import slugify from "slugify";
import {
  adminUrl,
  browserAdminPath,
} from "./AdminPath";
import {API_BASE_PATH} from "./ApiVersion";
import {OAUTH_AUTHORIZATION_SERVER_METADATA_PATH} from "./OAuth";

export function randomHex(size: any = 32) {
  const bytes = new Uint8Array(Math.ceil(size / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte: any) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, size);
}

export function isValidUrl(url: any) {
  let theUrl;
  try {
    theUrl = new URL(url);
  } catch (_) {
    return false;
  }

  return theUrl.protocol === 'http:' || theUrl.protocol === 'https:';
}

export function isLocalDevelopmentHostname(hostname: string) {
  return hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]';
}

export function normalizePublicBucketUrl(value: unknown) {
  const url = String(value ?? '').trim();
  return url === '/media' || url === '/media/' ? '/media/' : url;
}

export function isValidPublicBucketUrl(value: unknown) {
  const url = normalizePublicBucketUrl(value);
  return url === '/media/' || isValidUrl(url);
}

export function normalizeR2CustomDomainUrl(value: unknown): string {
  const input = String(value ?? '').trim();
  if (!input || input.startsWith('/') || /\s/u.test(input)) {
    return '';
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//iu.test(input) ? input : `https://${input}`);
  } catch (_) {
    return '';
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.hostname === 'r2.dev' ||
    url.hostname.endsWith('.r2.dev') ||
    url.hostname === 'workers.dev' ||
    url.hostname.endsWith('.workers.dev')
  ) {
    return '';
  }

  return `${url.origin}/`;
}

export function isR2CustomDomainUrl(value: unknown): boolean {
  return Boolean(normalizeR2CustomDomainUrl(value));
}

export function suggestedR2CustomDomainUrl(hostname: string): string {
  if (
    isLocalDevelopmentHostname(hostname) ||
    hostname.endsWith('.workers.dev')
  ) {
    return 'https://media.example.com/';
  }

  const customHostname = hostname.replace(/^www\./iu, '');
  return `https://media.${customHostname}/`;
}

export function resolvePublicBucketUrl(
  value: unknown,
  hostname: string,
) {
  if (isLocalDevelopmentHostname(hostname)) {
    return '/media/';
  }
  return normalizePublicBucketUrl(value) || '/media/';
}

export function hasFileExtension(pathname: string) {
  const pathnameWithoutTrailingSlash = pathname.replace(/\/+$/u, '');
  return /\/[^/]+\.\w+$/u.test(pathnameWithoutTrailingSlash);
}

export function canonicalPathname(pathname: string) {
  if (pathname === '/') {
    return pathname;
  }
  const pathnameWithoutTrailingSlash = pathname.replace(/\/+$/u, '');
  if (
    pathnameWithoutTrailingSlash === OAUTH_AUTHORIZATION_SERVER_METADATA_PATH
  ) {
    return pathnameWithoutTrailingSlash;
  }
  return hasFileExtension(pathnameWithoutTrailingSlash)
    ? pathnameWithoutTrailingSlash
    : `${pathnameWithoutTrailingSlash}/`;
}

export function randomShortUUID(length: any = 11) {
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

export function secondsToHHMMSS(secs: any) {
  if (!secs) {
    return '00:00:00';
  }
  const secNum = parseInt(secs, 10)
  const hours = Math.floor(secNum / 3600)
  const minutes = Math.floor(secNum / 60) % 60
  const seconds = secNum % 60

  return [hours, minutes, seconds]
    .map((v: any) => v < 10 ? '0' + v : v)
    .join(":")
}

export function humanFileSize(size: any) {
    const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return Number((size / Math.pow(1024, i)).toFixed(2)) + ' ' +
      ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

function normalize (strArray: any) {
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

export function removeHostFromUrl(url: any) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search + urlObj.hash;
    return path.replace(/^\/+/g, '')
  } catch (e) {
    return url;
  }
}

export function mediaReferenceForStorage(
  value: string,
  configuredPublicBucketUrl?: unknown,
  requestUrl?: string,
): string {
  if (!requestUrl) return removeHostFromUrl(value);
  let mediaUrl: URL;
  let publicBucketUrl: URL;
  try {
    const request = new URL(requestUrl);
    mediaUrl = new URL(value, request);
    publicBucketUrl = new URL(
      resolvePublicBucketUrl(
        configuredPublicBucketUrl,
        request.hostname,
      ),
      request,
    );
  } catch {
    return value;
  }
  const bucketPath = publicBucketUrl.pathname.endsWith("/")
    ? publicBucketUrl.pathname
    : `${publicBucketUrl.pathname}/`;
  if (
    mediaUrl.origin === publicBucketUrl.origin &&
    mediaUrl.pathname.startsWith(bucketPath)
  ) {
    return `${mediaUrl.pathname.slice(bucketPath.length)}${mediaUrl.search}${mediaUrl.hash}`;
  }
  return value;
}

export function urlJoin(...args: any) {
  const parts = Array.from(Array.isArray(args[0]) ? args[0] : args);
  return normalize(parts);
}

/**
 * Path could be:
 * 1) Relative url to website, e.g., /assets/default/something.png, or
 * 2) Relative url to R2, e.g., production/something.png
 */
export function urlJoinWithRelative(baseUrl: any, path: any, baseUrlForRelativePath: any = '/') {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//iu.test(path)) {
    return path;
  }

  if (path.startsWith('/')) {
    return urlJoin(baseUrlForRelativePath, path);
  }
  if (baseUrl) {
    return urlJoin(baseUrl, path);
  }
  return urlJoin('/', path);
}

export function buildAudioUrlWithTracking(audioUrl: any, trackingUrls: any, protocal: any='https') {
  if (!audioUrl) {
    return '';
  }
  if (!trackingUrls || trackingUrls.length === 0) {
    return audioUrl;
  }

  try {
    const protocalRegex = /^https?:\/\//;
    const audioUrlNoProtocal = audioUrl.replace(protocalRegex, '');
    const trackingUrlsNoProtocal = trackingUrls.map((u: any) => u.replace(protocalRegex, ''));
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

export function getIdFromSlug(slug: any) {
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

export function escapeHtml(htmlStr: any) {
  return htmlStr.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function unescapeHtml(htmlStr: any) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    copy: "©",
    gt: ">",
    hellip: "…",
    laquo: "«",
    ldquo: "“",
    lsquo: "‘",
    lt: "<",
    mdash: "—",
    nbsp: "\u00a0",
    ndash: "–",
    quot: "\"",
    raquo: "»",
    rdquo: "”",
    reg: "®",
    rsquo: "’",
    trade: "™",
  };
  return String(htmlStr ?? "").replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/giu,
    (entity, decimal, hexadecimal, named) => {
      const codePoint = (value: number) =>
        value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
          ? String.fromCodePoint(value)
          : entity;
      if (decimal) {
        const value = Number.parseInt(decimal, 10);
        return codePoint(value);
      }
      if (hexadecimal) {
        const value = Number.parseInt(hexadecimal, 16);
        return codePoint(value);
      }
      return namedEntities[String(named).toLowerCase()] ?? entity;
    },
  );
}

export function htmlToPlainText(htmlStr: any, _options: any = null) {
  const text = String(htmlStr ?? "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/giu, "\n")
    .replace(/<[^>]+>/gu, " ");
  return unescapeHtml(text)
    .replace(/[^\S\n]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function truncateString(str: any, num: any, ellipsis: any = true) {
  if (str.length > num) {
    return `${str.slice(0, num)}${ellipsis ? '...' : ''}`;
  } else {
    return str;
  }
}

export function htmlMetaDescription(str: any, isHtml: any = true) {
  const text = isHtml ? htmlToPlainText(str) : str;
  // https://moz.com/learn/seo/meta-description
  return truncateString(text, 155);
}

/**
 * Admin urls
 */
export const ADMIN_URLS = {
  home: (baseUrl: any = '/') =>
    urlJoin(baseUrl, adminUrl("", browserAdminPath())),
  editPrimaryChannel: () =>
    adminUrl("channels/primary", browserAdminPath()),
  editItem: (itemId: any) =>
    adminUrl(`items/${itemId}`, browserAdminPath()),
  newItem: (baseUrl: any = '/') =>
    urlJoin(baseUrl, adminUrl("items/new", browserAdminPath())),
  allItems: () => adminUrl("items/list", browserAdminPath()),
  settings: () => adminUrl("settings", browserAdminPath()),
  api: () => adminUrl("api", browserAdminPath()),
  apiAuthentication: () => adminUrl("api/auth", browserAdminPath()),
  apiExplorer: () => adminUrl("api/explorer", browserAdminPath()),
  apiSettings: () => adminUrl("api/settings", browserAdminPath()),
  codeEditorSettings: () =>
    adminUrl("settings/code-editor", browserAdminPath()),
  themesSettings: () =>
    adminUrl("settings/themes", browserAdminPath()),
  themeDraft: (id: string) =>
    adminUrl(`settings/themes/drafts/${id}`, browserAdminPath()),
  login: () => adminUrl("login", browserAdminPath()),
  logout: () => adminUrl("logout", browserAdminPath()),

  ajaxFeed: () => adminUrl("ajax/feed", browserAdminPath()),
  ajaxR2Ops: () => adminUrl("ajax/r2-ops", browserAdminPath()),
  ajaxApiSettings: () => adminUrl("ajax/api/settings", browserAdminPath()),
  ajaxApiKeys: () => adminUrl("ajax/api/keys", browserAdminPath()),
  ajaxApiKey: (id: string) =>
    adminUrl(`ajax/api/keys/${id}`, browserAdminPath()),
  ajaxRotateApiKey: (id: string) =>
    adminUrl(`ajax/api/keys/${id}/rotate`, browserAdminPath()),
  ajaxThemes: () => adminUrl("ajax/themes", browserAdminPath()),
  ajaxTheme: (id: string) =>
    adminUrl(`ajax/themes/${id}`, browserAdminPath()),
  ajaxThemePreview: (id: string) =>
    adminUrl(`ajax/themes/${id}/preview`, browserAdminPath()),
  ajaxThemeDraft: (id: string) =>
    adminUrl(`ajax/themes/drafts/${id}`, browserAdminPath()),
  ajaxThemeDraftPreview: (id: string) =>
    adminUrl(`ajax/themes/drafts/${id}/preview`, browserAdminPath()),
};

/**
 * Public urls
 */
function webItem(
  itemId: string,
  itemTitle: string | null = null,
  baseUrl: any = '/',
  locale: any = 'en',
) {
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
        .replace(/['!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]/g, '-')
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
  webFeed: (baseUrl: any = '/') => {
    return urlJoin(baseUrl, '/');
  },
  rssFeed: (baseUrl: any='/') => {
    return urlJoin(baseUrl, '/rss/');
  },
  rssFeedStylesheet: (baseUrl: any='/') => {
    return urlJoin(baseUrl, '/rss/stylesheet/');
  },
  jsonFeed: (baseUrl: any='/') => {
    return urlJoin(baseUrl, 'json/');
  },
  jsonFeedOpenApiYaml: (baseUrl: any = '/') => {
    return urlJoin(baseUrl, `${API_BASE_PATH}openapi.yaml`);
  },
  jsonFeedOpenApiHtml: (baseUrl: any = '/') => {
    return urlJoin(baseUrl, API_BASE_PATH);
  },
  apiReference: (baseUrl: any = '/') => urlJoin(baseUrl, API_BASE_PATH),
  apiOpenApiJson: (baseUrl: any = '/') =>
    urlJoin(baseUrl, `${API_BASE_PATH}openapi.json`),
  apiOpenApiYaml: (baseUrl: any = '/') =>
    urlJoin(baseUrl, `${API_BASE_PATH}openapi.yaml`),
  apiLlms: (baseUrl: any = '/') =>
    urlJoin(baseUrl, `${API_BASE_PATH}llms.txt`),
  apiLlmsFull: (baseUrl: any = '/') =>
    urlJoin(baseUrl, `${API_BASE_PATH}llms-full.txt`),
  webItem,
  jsonItem: (itemId: any, itemTitle: any = null, baseUrl: any = '/', locale: any = 'en') => {
    return urlJoin(webItem(itemId, itemTitle, baseUrl, locale), 'json/');
  },
  rssItem: (itemId: any, itemTitle: any = null, baseUrl: any = '/', locale: any = 'en') => {
    return urlJoin(webItem(itemId, itemTitle, baseUrl, locale), 'rss/');
  },
};
