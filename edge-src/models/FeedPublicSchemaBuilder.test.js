import FeedPublicSchemaBuilder from "./FeedPublicSchemaBuilder";
import {STATUSES} from "../../common-src/Constants";

test('FeedPublicSchemaBuilder builds correct schema with new fields', () => {
  const content = {
    channel: {
      id: 'channel1',
      title: 'Test Channel',
      description: 'Test Description',
      link: 'https://example.com',
      language: 'en',
      publisher: 'Test Publisher',
      image: 'image.jpg',
    },
    items: [
      {
        id: 'item1',
        title: 'Test Item',
        subtitle: 'Test Subtitle',
        desc: 'Test Short Description',
        buttonText: 'Read More',
        name: 'Test Name',
        enabled: true,
        custom_link: 'https://example.com/custom',
        description: '<p>Test HTML Description</p>',
        link: 'https://example.com/item1',
        image: 'item-image.jpg',
        pubDateMs: 1640995200000,
        guid: 'item1-guid',
        status: STATUSES.PUBLISHED,
        'itunes:title': 'iTunes Title',
        'itunes:explicit': false,
        'itunes:episodeType': 'full',
        'itunes:season': 1,
        'itunes:episode': 1,
        mediaFile: {
          url: 'audio.mp3',
          category: 'audio',
          contentType: 'audio/mpeg',
          sizeByte: 1000000,
          durationSecond: 3600,
        }
      }
    ],
    settings: {
      webGlobalSettings: {
        publicBucketUrl: 'https://cdn.example.com/',
      },
      analytics: {
        urls: [],
      }
    },
    items_sort_order: 'newest_first',
  };

  const request = {
    cf: { timezone: 'UTC' }
  };

  const builder = new FeedPublicSchemaBuilder(content, 'https://example.com', request, false);
  const schema = builder.getSchema();

  // Test channel
  expect(schema.channel.title).toBe('Test Channel');
  expect(schema.channel.description).toBe('Test Description');

  // Test items with new fields
  expect(schema.items).toHaveLength(1);
  const item = schema.items[0];
  
  expect(item.title).toBe('Test Item');
  expect(item.subtitle).toBe('Test Subtitle');
  expect(item.desc).toBe('Test Short Description');
  expect(item.buttonText).toBe('Read More');
  expect(item.name).toBe('Test Name');
  expect(item.enabled).toBe(true);
  expect(item.custom_link).toBe('https://example.com/custom');
  expect(item.description).toBe('<p>Test HTML Description</p>');
  
  // Test iTunes metadata
  expect(item.itunes.title).toBe('iTunes Title');
  expect(item.itunes.explicit).toBe(false);
  expect(item.itunes.episodeType).toBe('full');
  expect(item.itunes.season).toBe(1);
  expect(item.itunes.episode).toBe(1);

  // Test media file
  expect(item.mediaFile).toBeTruthy();
  expect(item.mediaFile.isAudio).toBe(true);
  expect(item.mediaFile.durationSecond).toBe(3600);

  // Test attachment
  expect(item.attachment).toBeTruthy();
  expect(item.attachment.mimeType).toBe('audio/mpeg');

  // Test meta
  expect(schema.meta.baseUrl).toBe('https://example.com');
  expect(schema.meta.itemsSortOrder).toBe('newest_first');
});
