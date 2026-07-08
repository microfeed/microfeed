import FeedDb from "./FeedDb";
import ContentService from "./ContentService";
import ItemRepo from "./ItemRepo";
import TagService from "./TagService";
import RelationRepo, {GALLERY_MEMBER} from "./RelationRepo";
import {STATUSES} from "../../common-src/Constants";

const {createMigratedInMemoryDatabase} = require("../../test-utils/d1-substitute");

function makeFeedDb(db) {
  return new FeedDb({FEED_DB: db}, {url: "https://example.com/"});
}

function makeContentService(db, feedDb) {
  return new ContentService({}, feedDb, {url: "https://example.com/"});
}

describe("JSON feed integration (registry-driven serializer)", () => {
  test("feed items include every content type, tags, resolved gallery members; excludes unpublished", async () => {
    const db = createMigratedInMemoryDatabase();
    const feedDb = makeFeedDb(db);
    const service = makeContentService(db, feedDb);
    const itemRepo = new ItemRepo(db);
    const relationRepo = new RelationRepo(db);
    const tagService = new TagService(db);

    try {
      // Seed channel/settings rows (idempotent init), then set a public bucket url.
      await feedDb.getContent();
      await db.prepare(
        "UPDATE settings SET data = ? WHERE category = ?",
      ).bind(
        JSON.stringify({
          publicBucketUrl: "https://cdn.example.com",
          itemsSortOrder: "newest_first",
          itemsPerPage: 20,
        }),
        "webGlobalSettings",
      ).run();

      // Tags
      const newsTag = await tagService.create({name: "News"});
      const launchTag = await tagService.create({name: "Launch"});

      // Podcast episode (published) with audio + image
      const podcastId = await service.create("podcast_episode", {
        status: "published",
        title: "Episode One",
        url: "https://example.com/ep1",
        content_html: "<p>Show notes</p>",
        image: "production/ep1.png",
        attachment: {
          category: "audio",
          url: "production/ep1.mp3",
          mime_type: "audio/mpeg",
          size_in_bytes: 12345,
          duration_in_seconds: 600,
        },
        guid: "guid-1",
        date_published_ms: Date.parse("2024-07-04T00:00:00.000Z"),
      });

      // Blog article (published) with 2 tags
      const blogId = await service.create("blog_article", {
        status: "published",
        title: "Hello World",
        content_html: "<p>Body</p>",
        excerpt: "Short teaser",
        author: "Ada Lovelace",
        tags: [newsTag.id, launchTag.id],
        date_published_ms: Date.parse("2024-07-03T00:00:00.000Z"),
      });

      // Photos (published) — 2 of them, used as gallery members
      const photoOneId = await service.create("photo", {
        status: "published",
        title: "Sunset",
        image: "production/sunset.png",
        caption: "A beautiful sunset",
        taken_date: Date.parse("2024-06-01T00:00:00.000Z"),
      });
      const photoTwoId = await service.create("photo", {
        status: "published",
        title: "Sunrise",
        image: "production/sunrise.png",
        caption: "A beautiful sunrise",
        taken_date: Date.parse("2024-06-02T00:00:00.000Z"),
      });

      // Gallery aggregator referencing the two photos, in order
      const galleryId = await service.create("gallery", {
        status: "published",
        title: "Vacation",
        content_html: "<p>Trip photos</p>",
        members: [photoOneId, photoTwoId],
      });

      // An unpublished item that must not appear in the feed
      const unpublishedId = await service.create("blog_article", {
        status: "unpublished",
        title: "Draft Post",
        content_html: "<p>Not ready</p>",
      });

      const content = await feedDb.getContent({
        queryKwargs: {},
        limit: -1,
      });
      const jsonData = await feedDb.getPublicJsonData(content);

      const itemsById = Object.fromEntries(jsonData.items.map((item) => [item.id, item]));

      // 1. all types present
      expect(itemsById[podcastId]).toBeDefined();
      expect(itemsById[blogId]).toBeDefined();
      expect(itemsById[photoOneId]).toBeDefined();
      expect(itemsById[photoTwoId]).toBeDefined();
      expect(itemsById[galleryId]).toBeDefined();

      // 5. unpublished excluded
      expect(itemsById[unpublishedId]).toBeUndefined();

      // 2. blog tags + content_html
      const blogItem = itemsById[blogId];
      expect(blogItem.tags).toEqual(expect.arrayContaining([newsTag.id, launchTag.id]));
      expect(blogItem.tags).toHaveLength(2);
      expect(blogItem.content_html).toBe("<p>Body</p>");

      // 3. podcast absolute urls + iTunes fields
      const podcastItem = itemsById[podcastId];
      expect(podcastItem.attachment.url).toBe("https://cdn.example.com/production/ep1.mp3");
      expect(podcastItem.image).toBe("https://cdn.example.com/production/ep1.png");
      expect(podcastItem.guid).toBe("guid-1");

      // 4. gallery members in order
      const galleryItem = itemsById[galleryId];
      expect(galleryItem.items).toHaveLength(2);
      expect(galleryItem.items.map((member) => member.id)).toEqual([photoOneId, photoTwoId]);
      expect(galleryItem.items[0].content_type).toBe("photo");

      // sanity: relationRepo actually has ordered members
      const memberIds = await relationRepo.getMemberIds(galleryId, GALLERY_MEMBER);
      expect(memberIds).toEqual([photoOneId, photoTwoId]);
    } finally {
      db.close();
    }
  });
});
