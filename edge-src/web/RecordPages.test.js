const {createMigratedInMemoryDatabase} = require("../../test-utils/d1-substitute");
import ContentService from "../models/ContentService";
import ItemRepo from "../models/ItemRepo";
import FeedDb from "../models/FeedDb";
import {STATUSES} from "../../common-src/Constants";

import {onRequestGet as getBlogArticle} from "../../functions/blog/[slug]/index.jsx";
import {onRequestGet as getPhoto} from "../../functions/photo/[slug]/index.jsx";
import {onRequestGet as getPodcastEpisode} from "../../functions/i/[slug]/index.jsx";

function makeEnv(db) {
  return {FEED_DB: db};
}

function makeContentService(db) {
  const itemRepo = new ItemRepo(db);
  return {
    itemRepo,
    service: new ContentService({}, {itemRepo}, {url: "https://example.com/"}),
  };
}

async function setPublicBucketUrl(db, request, publicBucketUrl) {
  const feedDb = new FeedDb({FEED_DB: db}, request);
  const content = await feedDb.getContent();
  await feedDb._putSettingsToContent({
    ...content.settings,
    webGlobalSettings: {
      ...(content.settings.webGlobalSettings || {}),
      publicBucketUrl,
    },
  });
}

async function setSeoSettings(db, request, seoSettings) {
  const feedDb = new FeedDb({FEED_DB: db}, request);
  const content = await feedDb.getContent();
  await feedDb._putSettingsToContent({
    ...content.settings,
    seoSettings: {
      ...(content.settings.seoSettings || {}),
      ...seoSettings,
    },
  });
}

async function linkRelatedContent(db, parentId, childIds) {
  for (const [position, childId] of childIds.entries()) {
    await db.prepare(
      "INSERT INTO item_relations (parent_item_id, child_item_id, rel_type, position) VALUES (?, ?, ?, ?)",
    ).bind(parentId, childId, "related_content", position).run();
  }
}

function slugify(title) {
  return title.toLowerCase().replace(/\s+/g, "-");
}

async function createBlogArticle(service, itemRepo, title) {
  await service.create("blog_article", {
    status: "published",
    title,
    content_html: "<p>Body copy</p>",
  });
  return itemRepo.getByTypeAndSlug("blog_article", slugify(title));
}

async function createPhoto(service, itemRepo, title) {
  await service.create("photo", {
    status: "published",
    title,
    image: "https://cdn.example.com/production/photo.png",
    caption: title,
  });
  return itemRepo.getByTypeAndSlug("photo", slugify(title));
}

async function createPodcastEpisode(service, itemRepo, title) {
  await service.create("podcast_episode", {
    status: "published",
    title,
    content_html: "<p>Show notes</p>",
    attachment: {
      category: "audio",
      url: "https://cdn.example.com/production/episode.mp3",
      mime_type: "audio/mpeg",
    },
  });
  return itemRepo.getByTypeAndSlug("podcast_episode", slugify(title));
}

describe("record type web pages", () => {
  test("published blog_article renders 200 with title, content_html body, and tags", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("blog_article", {
        status: "published",
        title: "Hello World",
        content_html: "<p>Body copy</p>",
        author: "Ada Lovelace",
      });
      const row = await itemRepo.getByTypeAndSlug("blog_article", "hello-world");
      expect(row).toBeTruthy();

      const request = new Request("https://site.test/blog/hello-world");
      const response = await getBlogArticle({params: {slug: "hello-world"}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Hello World");
      expect(html).toContain("<p>Body copy</p>");
      expect(html).toContain("Ada Lovelace");
    } finally {
      db.close();
    }
  });

  test("published podcast_episode renders 200 with an audio element using the absolute attachment url", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const request = new Request("https://site.test/i/episode-one");
      await setPublicBucketUrl(db, request, "https://cdn.example.com");

      await service.create("podcast_episode", {
        status: "published",
        title: "Episode One",
        content_html: "<p>Show notes</p>",
        attachment: {
          category: "audio",
          url: "https://cdn.example.com/production/ep1.mp3",
          mime_type: "audio/mpeg",
        },
      });
      const row = await itemRepo.getByTypeAndSlug("podcast_episode", "episode-one");
      expect(row).toBeTruthy();

      const response = await getPodcastEpisode({params: {slug: "episode-one"}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Episode One");
      expect(html).toContain("<audio");
      expect(html).toContain("https://cdn.example.com/production/ep1.mp3");
    } finally {
      db.close();
    }
  });

  test("published photo renders 200 with image and caption", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("photo", {
        status: "published",
        title: "Sunset",
        image: "https://cdn.example.com/production/sunset.png",
        caption: "A beautiful sunset",
      });
      const row = await itemRepo.getByTypeAndSlug("photo", "sunset");
      expect(row).toBeTruthy();

      const request = new Request("https://site.test/photo/sunset");
      const response = await getPhoto({params: {slug: "sunset"}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("<img");
      expect(html).toContain("A beautiful sunset");
    } finally {
      db.close();
    }
  });

  test("unknown slug returns 404", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const request = new Request("https://site.test/blog/does-not-exist");
      const response = await getBlogArticle({params: {slug: "does-not-exist"}, env: makeEnv(db), request});
      expect(response.status).toBe(404);
    } finally {
      db.close();
    }
  });

  test("UNPUBLISHED item at a known slug returns 404", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("blog_article", {
        status: "unpublished",
        title: "Hidden Post",
        content_html: "<p>Body</p>",
      });
      const row = await itemRepo.getByTypeAndSlug("blog_article", "hidden-post");
      expect(row).toMatchObject({status: STATUSES.UNPUBLISHED});

      const request = new Request("https://site.test/blog/hidden-post");
      const response = await getBlogArticle({params: {slug: "hidden-post"}, env: makeEnv(db), request});
      expect(response.status).toBe(404);
    } finally {
      db.close();
    }
  });

  test("UNLISTED item at a known slug returns 200", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("blog_article", {
        status: "unlisted",
        title: "Unlisted Post",
        content_html: "<p>Body</p>",
      });
      const row = await itemRepo.getByTypeAndSlug("blog_article", "unlisted-post");
      expect(row).toMatchObject({status: STATUSES.UNLISTED});

      const request = new Request("https://site.test/blog/unlisted-post");
      const response = await getBlogArticle({params: {slug: "unlisted-post"}, env: makeEnv(db), request});
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Unlisted Post");
    } finally {
      db.close();
    }
  });

  test("detail page renders the public nav populated from published content", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("blog_article", {
        status: "published",
        title: "Navigable Post",
        content_html: "<p>Body</p>",
      });
      const row = await itemRepo.getByTypeAndSlug("blog_article", "navigable-post");
      expect(row).toBeTruthy();

      const request = new Request("https://site.test/blog/navigable-post");
      const response = await getBlogArticle({params: {slug: "navigable-post"}, env: makeEnv(db), request});
      expect(response.status).toBe(200);
      const html = await response.text();
      // The shared public nav must appear on record detail pages, and it
      // must be populated with a link to the type's listing (a published
      // blog_article exists, so the "Blog" listing link should show).
      expect(html).toContain("public-nav");
      expect(html).toContain('href="/blog/"');
      // no-referrer meta keeps bucket-hosted cover images from being blocked
      // by Cloudflare hotlink protection when viewed cross-origin.
      expect(html).toContain('name="referrer" content="no-referrer"');
    } finally {
      db.close();
    }
  });

  test("blog detail HTML has BlogPosting JSON-LD + og:title", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("blog_article", {
        status: "published",
        title: "SEO Blog Post",
        content_html: "<p>Some SEO-worthy body copy.</p>",
        author: "Ada Lovelace",
      });
      const row = await itemRepo.getByTypeAndSlug("blog_article", "seo-blog-post");
      expect(row).toBeTruthy();

      const request = new Request("https://site.test/blog/seo-blog-post");
      const response = await getBlogArticle({params: {slug: "seo-blog-post"}, env: makeEnv(db), request});
      expect(response.status).toBe(200);
      const html = await response.text();

      expect(html).toContain('property="og:title" content="SEO Blog Post"');
      const scriptMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(scriptMatch).toBeTruthy();
      const jsonLd = JSON.parse(scriptMatch[1]);
      expect(jsonLd["@type"]).toBe("BlogPosting");
      expect(jsonLd.headline).toBe("SEO Blog Post");
    } finally {
      db.close();
    }
  });

  test("blog detail renders the shared Read next strip for related items", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const relatedBlog = await createBlogArticle(service, itemRepo, "Related Blog");
      const relatedPhoto = await createPhoto(service, itemRepo, "Related Photo");
      const relatedPodcast = await createPodcastEpisode(service, itemRepo, "Related Podcast");

      const source = await createBlogArticle(service, itemRepo, "Strip Source");
      await linkRelatedContent(db, source.id, [relatedBlog.id, relatedPhoto.id, relatedPodcast.id]);

      const request = new Request("https://site.test/blog/strip-source");
      const response = await getBlogArticle({params: {slug: "strip-source"}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Read next");
      expect(html).toContain("Related Blog");
      expect(html).toContain("Related Photo");
      expect(html).toContain("Related Podcast");
      expect(html).toContain("class=\"item-card\"");
    } finally {
      db.close();
    }
  });

  test("photo detail renders the shared Read next strip for related items", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const relatedBlog = await createBlogArticle(service, itemRepo, "Photo Related Blog");
      const relatedPodcast = await createPodcastEpisode(service, itemRepo, "Photo Related Podcast");

      const source = await createPhoto(service, itemRepo, "Photo Strip Source");
      await linkRelatedContent(db, source.id, [relatedBlog.id, relatedPodcast.id]);

      const request = new Request("https://site.test/photo/photo-strip-source");
      const response = await getPhoto({params: {slug: "photo-strip-source"}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Read next");
      expect(html).toContain("Photo Related Blog");
      expect(html).toContain("Photo Related Podcast");
      expect(html).toContain("class=\"item-card\"");
    } finally {
      db.close();
    }
  });

  test("podcast detail renders the shared Read next strip for related items", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const relatedBlog = await createBlogArticle(service, itemRepo, "Podcast Related Blog");
      const relatedPhoto = await createPhoto(service, itemRepo, "Podcast Related Photo");

      const source = await createPodcastEpisode(service, itemRepo, "Podcast Strip Source");
      await linkRelatedContent(db, source.id, [relatedBlog.id, relatedPhoto.id]);

      const request = new Request("https://site.test/i/podcast-strip-source");
      const response = await getPodcastEpisode({params: {slug: "podcast-strip-source"}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Read next");
      expect(html).toContain("Podcast Related Blog");
      expect(html).toContain("Podcast Related Photo");
      expect(html).toContain("class=\"item-card\"");
    } finally {
      db.close();
    }
  });

  test("podcast detail HTML has PodcastEpisode JSON-LD", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const request = new Request("https://site.test/i/seo-episode");
      await setPublicBucketUrl(db, request, "https://cdn.example.com");

      await service.create("podcast_episode", {
        status: "published",
        title: "SEO Episode",
        content_html: "<p>Show notes</p>",
        attachment: {
          category: "audio",
          url: "https://cdn.example.com/production/seo-ep.mp3",
          mime_type: "audio/mpeg",
        },
      });
      await itemRepo.getByTypeAndSlug("podcast_episode", "seo-episode");

      const response = await getPodcastEpisode({params: {slug: "seo-episode"}, env: makeEnv(db), request});
      expect(response.status).toBe(200);
      const html = await response.text();

      const scriptMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(scriptMatch).toBeTruthy();
      const jsonLd = JSON.parse(scriptMatch[1]);
      expect(jsonLd["@type"]).toBe("PodcastEpisode");
    } finally {
      db.close();
    }
  });

  test("a noindex item emits robots noindex,nofollow", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("blog_article", {
        status: "published",
        title: "Hidden From Search",
        content_html: "<p>Body</p>",
        noindex: true,
      });
      await itemRepo.getByTypeAndSlug("blog_article", "hidden-from-search");

      const request = new Request("https://site.test/blog/hidden-from-search");
      const response = await getBlogArticle({params: {slug: "hidden-from-search"}, env: makeEnv(db), request});
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('name="robots" content="noindex,nofollow"');
    } finally {
      db.close();
    }
  });

  test("UNLISTED item is noindex", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("blog_article", {
        status: "unlisted",
        title: "Unlisted SEO Post",
        content_html: "<p>Body</p>",
      });
      await itemRepo.getByTypeAndSlug("blog_article", "unlisted-seo-post");

      const request = new Request("https://site.test/blog/unlisted-seo-post");
      const response = await getBlogArticle({params: {slug: "unlisted-seo-post"}, env: makeEnv(db), request});
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('name="robots" content="noindex,nofollow"');
    } finally {
      db.close();
    }
  });

  test("seoSettings publisher name flows into JSON-LD publisher node", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const request = new Request("https://site.test/blog/branded-post");
      await setSeoSettings(db, request, {publisherType: "Organization", publisherName: "Acme Publishing"});

      await service.create("blog_article", {
        status: "published",
        title: "Branded Post",
        content_html: "<p>Body</p>",
      });
      await itemRepo.getByTypeAndSlug("blog_article", "branded-post");

      const response = await getBlogArticle({params: {slug: "branded-post"}, env: makeEnv(db), request});
      const html = await response.text();
      const scriptMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      const jsonLd = JSON.parse(scriptMatch[1]);
      expect(jsonLd.publisher).toMatchObject({"@type": "Organization", name: "Acme Publishing"});
    } finally {
      db.close();
    }
  });

  test("detail page includes feed/sitemap discovery links in <head>", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("blog_article", {
        status: "published",
        title: "Discovery Post",
        content_html: "<p>Body</p>",
      });
      await itemRepo.getByTypeAndSlug("blog_article", "discovery-post");

      const request = new Request("https://site.test/blog/discovery-post");
      const response = await getBlogArticle({params: {slug: "discovery-post"}, env: makeEnv(db), request});
      const html = await response.text();

      expect(html).toContain('type="application/rss+xml"');
      expect(html).toContain('type="application/feed+json"');
      expect(html).toContain('rel="sitemap"');
    } finally {
      db.close();
    }
  });
});
