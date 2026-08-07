import {expect, test} from "vitest";
import FeedCrudManager from "@/server/feed/FeedCrudManager";
import {STATUSES} from "@/shared/Constants";

test('_publicToInternalSchemaForChannel', () => {
  const publicChannel = {
    'title': 'title',
    'home_page_url': 'url1',
    'description': 'desc',
    'icon': 'https://www.image.com/abc/image.jpg',
    'authors': [{'name': 'author'}],
    'language': 'en',
    'expired': true,
    '_microfeed': {
      'itunes:explicit': true,
      'itunes:title': 'title2',
      'itunes:block': true,
      'itunes:type': 'episodic',
      'itunes:email': 'email',
    },
  };
  const mgr = new FeedCrudManager(
    {settings: {webGlobalSettings: {publicBucketUrl: "/media/"}}},
    undefined,
    new Request("https://feed.example.com/api/v1/channels/primary/"),
  );
  const internalChannel = mgr._publicToInternalSchemaForChannel(publicChannel);
  expect(internalChannel.title).toBe(publicChannel.title);
  expect(internalChannel.link).toBe(publicChannel.home_page_url);
  expect(internalChannel.description).toBe(publicChannel.description);
  expect(internalChannel.image).toBe(publicChannel.icon);
  expect(internalChannel.publisher).toBe(publicChannel.authors[0]!.name);
  expect(internalChannel['itunes:explicit']).toBe(publicChannel._microfeed['itunes:explicit']);
  expect(internalChannel['itunes:block']).toBe(publicChannel._microfeed['itunes:block']);
  expect(internalChannel['itunes:type']).toBe(publicChannel._microfeed['itunes:type']);
  expect(internalChannel['copyright']).toBe(
    (publicChannel._microfeed as Record<string, unknown>)['copyright'],
  );
  expect(internalChannel['itunes:email']).toBe(publicChannel._microfeed['itunes:email']);
});

test('_publicToInternalSchemaForItem', () => {
  const publicItem = {
    'title': 'title',
    'image': 'https://www.image.com/abc/image.jpg',
    'status': STATUSES.UNPUBLISHED,
    'attachment': {
      'url': 'https://www.audio.com/bbc/audio.mp3',
      'category': 'audio',
    },
    'date_published_ms': 324444,
    '_microfeed': {
      'itunes:block': true,
      'itunes:episodeType': 'bonus',
      'itunes:explicit': false,
    },
  };
  const mgr = new FeedCrudManager(
    {settings: {webGlobalSettings: {publicBucketUrl: "/media/"}}},
    undefined,
    new Request("https://feed.example.com/api/v1/items/item-id/"),
  );
  const internalItem = mgr._publicToInternalSchemaForItem(publicItem);

  expect(internalItem.title).toBe(publicItem.title);
  expect(internalItem.image).toBe(publicItem.image);
  expect(internalItem.status).toBe(publicItem.status);
  expect(internalItem.mediaFile.url).toBe(publicItem.attachment.url);
  expect(internalItem.mediaFile.category).toBe(publicItem.attachment.category);
  expect(internalItem.pubDateMs).toBe(publicItem.date_published_ms);
  expect(internalItem['itunes:block']).toBe(publicItem._microfeed['itunes:block']);
  expect(internalItem['itunes:episodeType']).toBe(publicItem._microfeed['itunes:episodeType']);
  expect(internalItem['itunes:explicit']).toBe(publicItem._microfeed['itunes:explicit']);
});

test('same-site uploaded media is stored without duplicating the media base', () => {
  const mgr = new FeedCrudManager(
    {settings: {webGlobalSettings: {publicBucketUrl: "/media/"}}},
    undefined,
    new Request("https://feed.example.com/api/v1/items/item-id/"),
  );
  const internalItem = mgr._publicToInternalSchemaForItem({
    image: "https://feed.example.com/media/production/media/image.png",
  });

  expect(internalItem.image).toBe("production/media/image.png");
});
