import {expect, test} from "vitest";
import {OAUTH_AUTHORIZATION_SERVER_METADATA_PATH} from "@/shared/OAuth";
import {
  ADMIN_URLS,
  buildAudioUrlWithTracking,
  canonicalPathname,
  hasFileExtension,
  htmlToPlainText,
  isLocalDevelopmentHostname,
  isR2CustomDomainUrl,
  isValidPublicBucketUrl,
  mediaReferenceForStorage,
  normalizePublicBucketUrl,
  normalizeR2CustomDomainUrl,
  PUBLIC_URLS,
  randomShortUUID,
  removeHostFromUrl,
  resolvePublicBucketUrl,
  suggestedR2CustomDomainUrl,
  urlJoinWithRelative,
} from "@/shared/StringUtils";

test("htmlToPlainText strips markup and normalizes decoded text", () => {
  expect(htmlToPlainText(
    "<h1>Hello&nbsp;&amp; welcome</h1><p>Line &#x32; &#8212; done</p>" +
      "<script>ignore()</script><style>.ignore{}</style>",
  )).toBe("Hello & welcome\nLine 2 — done");
  expect(htmlToPlainText("<p>Unclosed <strong>markup &copy;")).toBe(
    "Unclosed markup ©",
  );
  expect(htmlToPlainText("")).toBe("");
});

test('randomShortUUID', () => {
  expect(randomShortUUID().length).toBe(11);
  expect(randomShortUUID(20).length).toBe(20);
});

test('buildAudioUrlWithTracking', () => {
  const audioUrl = 'https://www.audio.com/audio.mp3'
  let trackingUrls = [
    'http://firsturl.com/123',
    'https://secondurl.com/abc/',
    'https://thridurl.com/aaa/bbb',
    'www.noprotocal.com/asdfsad',
  ];
  const finalUrl = 'https://firsturl.com/123/secondurl.com/abc/thridurl.com/aaa/bbb/www.noprotocal.com/asdfsad/www.audio.com/audio.mp3';
  expect(buildAudioUrlWithTracking(audioUrl, trackingUrls)).toBe(finalUrl);

  trackingUrls = [];
  expect(buildAudioUrlWithTracking(audioUrl, trackingUrls)).toBe(audioUrl);

  trackingUrls = ['http://firsturl.com/123/'];
  expect(buildAudioUrlWithTracking(audioUrl, trackingUrls)).toBe("https://firsturl.com/123/www.audio.com/audio.mp3");

  trackingUrls = [''];
  expect(buildAudioUrlWithTracking(audioUrl, trackingUrls)).toBe(audioUrl);
});

test('removeHostFromUrl', () => {
  const url = 'https://www.audio.com/project/hello/audio.mp3';
  expect(removeHostFromUrl(url)).toBe('project/hello/audio.mp3');
  const badUrl = 'asfafffaf'
  expect(removeHostFromUrl(badUrl)).toBe(badUrl);
});

test('media URLs are stored relative only to the configured public bucket', () => {
  expect(mediaReferenceForStorage(
    "https://feed.example.com/media/production/media/image.png",
    "/media/",
    "https://feed.example.com/api/v1/items/item-id/",
  )).toBe("production/media/image.png");
  expect(mediaReferenceForStorage(
    "https://cdn.example.com/production/media/image.png",
    "https://cdn.example.com/",
    "https://feed.example.com/api/v1/items/item-id/",
  )).toBe("production/media/image.png");
  expect(mediaReferenceForStorage(
    "https://images.example.net/image.png",
    "/media/",
    "https://feed.example.com/api/v1/items/item-id/",
  )).toBe("https://images.example.net/image.png");
});

test('local development hostnames are detected without matching arbitrary hosts', () => {
  expect(isLocalDevelopmentHostname('localhost')).toBe(true);
  expect(isLocalDevelopmentHostname('microfeed.localhost')).toBe(true);
  expect(isLocalDevelopmentHostname('127.0.0.1')).toBe(true);
  expect(isLocalDevelopmentHostname('[::1]')).toBe(true);
  expect(isLocalDevelopmentHostname('microfeed.example.com')).toBe(false);
});

test('public bucket URLs accept the Worker media route and absolute HTTP URLs', () => {
  expect(normalizePublicBucketUrl('/media')).toBe('/media/');
  expect(isValidPublicBucketUrl('/media/')).toBe(true);
  expect(isValidPublicBucketUrl('https://media.example.com/')).toBe(true);
  expect(isValidPublicBucketUrl('http://media.example.com/')).toBe(true);
  expect(isValidPublicBucketUrl('/another-path/')).toBe(false);
  expect(isValidPublicBucketUrl('media.example.com')).toBe(false);
});

test('R2 custom domains normalize safe production hostnames', () => {
  expect(normalizeR2CustomDomainUrl('media.example.com')).toBe(
    'https://media.example.com/',
  );
  expect(normalizeR2CustomDomainUrl('https://media.example.com')).toBe(
    'https://media.example.com/',
  );
  expect(isR2CustomDomainUrl('https://media.example.com/')).toBe(true);
  expect(isR2CustomDomainUrl('http://media.example.com/')).toBe(false);
  expect(isR2CustomDomainUrl('/media/')).toBe(false);
  expect(isR2CustomDomainUrl('https://example.r2.dev/')).toBe(false);
  expect(isR2CustomDomainUrl('https://example.workers.dev/')).toBe(false);
  expect(isR2CustomDomainUrl('https://media.example.com/path')).toBe(false);
});

test('R2 custom-domain suggestions use the active site domain', () => {
  expect(suggestedR2CustomDomainUrl('feed.example.com')).toBe(
    'https://media.feed.example.com/',
  );
  expect(suggestedR2CustomDomainUrl('www.example.com')).toBe(
    'https://media.example.com/',
  );
  expect(suggestedR2CustomDomainUrl('example.workers.dev')).toBe(
    'https://media.example.com/',
  );
});

test('local development always uses the Worker media route', () => {
  expect(resolvePublicBucketUrl(
    'http://localhost:4321/media/',
    'localhost',
  )).toBe('/media/');
  expect(resolvePublicBucketUrl(
    'https://media.example.com/',
    '127.0.0.1',
  )).toBe('/media/');
  expect(resolvePublicBucketUrl(
    'https://media.example.com/',
    'feed.example.com',
  )).toBe('https://media.example.com/');
  expect(resolvePublicBucketUrl('', 'feed.example.com')).toBe('/media/');
});

test('application page URLs always include a trailing slash', () => {
  const urls = [
    ADMIN_URLS.home(),
    ADMIN_URLS.editPrimaryChannel(),
    ADMIN_URLS.editItem("abcdefghijk"),
    ADMIN_URLS.newItem(),
    ADMIN_URLS.allItems(),
    ADMIN_URLS.settings(),
    ADMIN_URLS.api(),
    ADMIN_URLS.apiAuthentication(),
    ADMIN_URLS.apiExplorer(),
    ADMIN_URLS.apiSettings(),
    ADMIN_URLS.codeEditorSettings(),
    ADMIN_URLS.ajaxFeed(),
    ADMIN_URLS.ajaxApiSettings(),
    ADMIN_URLS.ajaxApiKeys(),
    ADMIN_URLS.ajaxApiKey("key-id"),
    ADMIN_URLS.ajaxRotateApiKey("key-id"),
    PUBLIC_URLS.webFeed(),
    PUBLIC_URLS.rssFeed(),
    PUBLIC_URLS.rssFeedStylesheet(),
    PUBLIC_URLS.jsonFeed(),
    PUBLIC_URLS.webItem("abcdefghijk"),
    PUBLIC_URLS.jsonItem("abcdefghijk"),
    PUBLIC_URLS.rssItem("abcdefghijk"),
  ];

  expect(urls.every((url) => url.endsWith("/"))).toBe(true);
});

test('literal file endpoints do not include a trailing slash', () => {
  expect(PUBLIC_URLS.jsonFeedOpenApiYaml()).toBe("/api/v1/openapi.yaml");
  expect(PUBLIC_URLS.jsonFeedOpenApiHtml()).toBe("/api/v1/");
  expect(PUBLIC_URLS.apiOpenApiJson()).toBe("/api/v1/openapi.json");
  expect(PUBLIC_URLS.apiLlmsFull()).toBe("/api/v1/llms-full.txt");
});

test('file paths are slashless while application paths retain trailing slashes', () => {
  expect(hasFileExtension("/media/project/image.png")).toBe(true);
  expect(hasFileExtension("/media/project/archive.tar.gz/")).toBe(true);
  expect(hasFileExtension("/admin/items/list/")).toBe(false);
  expect(canonicalPathname("/media/project/image.png/")).toBe(
    "/media/project/image.png",
  );
  expect(canonicalPathname("/admin/items/list")).toBe("/admin/items/list/");
  expect(canonicalPathname(OAUTH_AUTHORIZATION_SERVER_METADATA_PATH)).toBe(
    OAUTH_AUTHORIZATION_SERVER_METADATA_PATH,
  );
  expect(canonicalPathname(
    `${OAUTH_AUTHORIZATION_SERVER_METADATA_PATH}/`,
  )).toBe(OAUTH_AUTHORIZATION_SERVER_METADATA_PATH);
  expect(canonicalPathname("/")).toBe("/");
});

test('absolute media URLs are not joined to the configured public bucket', () => {
  expect(urlJoinWithRelative(
    "/media/",
    "https://images.example.net/image.png",
  )).toBe("https://images.example.net/image.png");
});

test('Worker media routes do not add a trailing slash to R2 object keys', () => {
  const objectKey = "production/media/audio.mp3";
  expect(urlJoinWithRelative("/media/", objectKey)).toBe(
    "/media/production/media/audio.mp3",
  );
  expect(urlJoinWithRelative("https://cdn.example.com/", objectKey)).toBe(
    "https://cdn.example.com/production/media/audio.mp3",
  );
});
