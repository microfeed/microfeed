import {XMLParser} from "fast-xml-parser";
import FeedDb from "./FeedDb";
import ContentService from "./ContentService";
import TagService from "./TagService";
import {getRssKind} from "../registry/ContentTypeRegistry";

const {createMigratedInMemoryDatabase} = require("../../test-utils/d1-substitute");

function makeFeedDb(db) {
  return new FeedDb({FEED_DB: db}, {url: "https://example.com/"});
}

function makeContentService(feedDb) {
  return new ContentService({}, feedDb, {url: "https://example.com/"});
}

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: "@_", cdataPropName: "@cdata"});

describe("FeedPublicRssBuilder (type-aware: podcast iTunes + blog basic)", () => {
  async function seed() {
    const db = createMigratedInMemoryDatabase();
    const feedDb = makeFeedDb(db);
    const service = makeContentService(feedDb);
    const tagService = new TagService(db);

    // Seed channel/settings, then set public bucket url.
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
      _microfeed: {
        "itunes:season": 1,
        "itunes:episode": 2,
        "itunes:explicit": true,
      },
      date_published_ms: Date.parse("2024-07-04T00:00:00.000Z"),
    });

    const newsTag = await tagService.create({name: "News"});
    const launchTag = await tagService.create({name: "Launch"});

    const blogId = await service.create("blog_article", {
      status: "published",
      title: "Hello World",
      content_html: "<p>Body</p>",
      excerpt: "Short teaser",
      author: "Ada Lovelace",
      tags: [newsTag.id, launchTag.id],
      date_published_ms: Date.parse("2024-07-03T00:00:00.000Z"),
    });

    const photoId = await service.create("photo", {
      status: "published",
      title: "Sunset",
      image: "production/sunset.png",
      caption: "A beautiful sunset",
      taken_date: Date.parse("2024-06-01T00:00:00.000Z"),
    });

    const content = await feedDb.getContent({queryKwargs: {}, limit: -1});
    const jsonData = await feedDb.getPublicJsonData(content);

    return {db, feedDb, jsonData, podcastId, blogId, photoId};
  }

  test("getRssKind returns itunes/basic/null per type", () => {
    expect(getRssKind("podcast_episode")).toBe("itunes");
    expect(getRssKind("blog_article")).toBe("basic");
    expect(getRssKind("photo")).toBeNull();
    expect(getRssKind("gallery")).toBeNull();
    expect(getRssKind("landing_page")).toBeNull();
  });

  test("podcast RSS: valid XML, has enclosure + itunes tags + pubDate, excludes blog item", async () => {
    const {db, jsonData, podcastId, blogId} = await seed();
    try {
      const FeedPublicRssBuilder = require("./FeedPublicRssBuilder").default;
      const builder = new FeedPublicRssBuilder(jsonData, "https://example.com", {
        contentType: "podcast_episode",
      });
      const xml = builder.getRssData();

      expect(typeof xml).toBe("string");
      const parsed = parser.parse(xml);
      expect(parsed.rss.channel).toBeDefined();

      expect(xml).toContain("<enclosure");
      expect(xml).toContain('url="https://cdn.example.com/production/ep1.mp3"');
      expect(xml).toContain('type="audio/mpeg"');
      expect(xml).toContain('length="12345"');
      expect(xml).toContain("<itunes:season>1</itunes:season>");
      expect(xml).toContain("<itunes:episode>2</itunes:episode>");
      expect(xml).toContain("<itunes:explicit>true</itunes:explicit>");
      expect(xml).toContain("<pubDate>");
      expect(xml).toContain(new Date(Date.parse("2024-07-04T00:00:00.000Z")).toUTCString());

      // Does not include the blog item.
      expect(xml).not.toContain("Hello World");
      expect(xml).not.toContain(blogId);
      expect(xml).toContain(podcastId);
    } finally {
      db.close();
    }
  });

  test("blog RSS: valid RSS 2.0, has title/link/description/guid/pubDate, no enclosure/itunes, excludes podcast", async () => {
    const {db, jsonData, podcastId, blogId} = await seed();
    try {
      const FeedPublicRssBuilder = require("./FeedPublicRssBuilder").default;
      const builder = new FeedPublicRssBuilder(jsonData, "https://example.com", {
        contentType: "blog_article",
      });
      const xml = builder.getRssData();

      expect(typeof xml).toBe("string");
      const parsed = parser.parse(xml);
      expect(parsed.rss.channel).toBeDefined();

      expect(xml).toContain("<title>Hello World</title>");
      expect(xml).toContain("<guid>" + blogId + "</guid>");
      expect(xml).toContain("<pubDate>");
      expect(xml).toContain(new Date(Date.parse("2024-07-03T00:00:00.000Z")).toUTCString());
      expect(xml).toMatch(/<description>[\s\S]*<!\[CDATA\[<p>Body<\/p>]]>[\s\S]*<\/description>/);

      expect(xml).not.toContain("<enclosure");
      expect(xml).not.toContain("itunes:season");
      expect(xml).not.toContain("itunes:episode");
      expect(xml).not.toContain("itunes:explicit");

      // Does not include the podcast item.
      expect(xml).not.toContain("Episode One");
      expect(xml).not.toContain(podcastId);
    } finally {
      db.close();
    }
  });

  test("type with no rss config (photo) yields a valid empty channel", async () => {
    const {db, jsonData} = await seed();
    try {
      expect(getRssKind("photo")).toBeNull();

      const FeedPublicRssBuilder = require("./FeedPublicRssBuilder").default;
      const builder = new FeedPublicRssBuilder(jsonData, "https://example.com", {
        contentType: "photo",
        rssKind: null,
      });
      const xml = builder.getRssData();

      expect(typeof xml).toBe("string");
      const parsed = parser.parse(xml);
      expect(parsed.rss.channel).toBeDefined();
      expect(parsed.rss.channel.item).toBeUndefined();
    } finally {
      db.close();
    }
  });

  test("FeedDb.getPublicRssData builds podcast and blog feeds", async () => {
    const {db, feedDb, podcastId, blogId} = await seed();
    try {
      const content = await feedDb.getContent({queryKwargs: {}, limit: -1});
      const podcastXml = await feedDb.getPublicRssData(content, "podcast_episode");
      const blogXml = await feedDb.getPublicRssData(content, "blog_article");

      expect(podcastXml).toContain(podcastId);
      expect(podcastXml).not.toContain(blogId);

      expect(blogXml).toContain(blogId);
      expect(blogXml).not.toContain(podcastId);
    } finally {
      db.close();
    }
  });
});
