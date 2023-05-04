import FeedCrudManager from "./FeedCrudManager";
import {STATUSES} from "../../common-src/Constants";

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
    'itunes:block': true,
    'itunes:episodeType': 'bonus',
    'itunes:explicit': false,
  };
  const mgr = new FeedCrudManager();
  const internalItem = mgr._publicToInternalSchemaForItem(publicItem);

  expect(internalItem.title).toBe(publicItem.title);
  expect(internalItem.image).toBe('abc/image.jpg');
  expect(internalItem.status).toBe(publicItem.status);
  expect(internalItem.mediaFile.url).toBe('bbc/audio.mp3');
  expect(internalItem.mediaFile.category).toBe(publicItem.attachment.category);
  expect(internalItem.pubDateMs).toBe(publicItem.date_published_ms);
  expect(internalItem['itunes:block']).toBe(publicItem['itunes:block']);
  expect(internalItem['itunes:episodeType']).toBe(publicItem['itunes:episodeType']);
  expect(internalItem['itunes:explicit']).toBe(publicItem['itunes:explicit']);
});
