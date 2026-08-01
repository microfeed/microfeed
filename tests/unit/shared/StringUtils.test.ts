import {expect, test} from "vitest";
import {
  ADMIN_URLS,
  buildAudioUrlWithTracking,
  canonicalPathname,
  hasFileExtension,
  isLocalDevelopmentHostname,
  isR2CustomDomainUrl,
  isValidPublicBucketUrl,
  normalizePublicBucketUrl,
  normalizeR2CustomDomainUrl,
  PUBLIC_URLS,
  randomShortUUID,
  removeHostFromUrl,
  resolvePublicBucketUrl,
  suggestedR2CustomDomainUrl,
  urlJoinWithRelative,
} from "@/shared/StringUtils";

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
    ADMIN_URLS.codeEditorSettings(),
    ADMIN_URLS.ajaxFeed(),
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
  expect(PUBLIC_URLS.jsonFeedOpenApiYaml()).toBe("/json/openapi.yaml");
  expect(PUBLIC_URLS.jsonFeedOpenApiHtml()).toBe("/json/openapi.html");
});

test('file paths are slashless while application paths retain trailing slashes', () => {
  expect(hasFileExtension("/media/project/image.png")).toBe(true);
  expect(hasFileExtension("/media/project/archive.tar.gz/")).toBe(true);
  expect(hasFileExtension("/admin/items/list/")).toBe(false);
  expect(canonicalPathname("/media/project/image.png/")).toBe(
    "/media/project/image.png",
  );
  expect(canonicalPathname("/admin/items/list")).toBe("/admin/items/list/");
  expect(canonicalPathname("/")).toBe("/");
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
