const {createMigratedInMemoryDatabase} = require("../../test-utils/d1-substitute");
import ContentService from "../models/ContentService";
import ItemRepo from "../models/ItemRepo";
import FeedDb from "../models/FeedDb";
import TagService from "../models/TagService";

import {onRequestGet as getGallery} from "../../functions/gallery/[slug]/index.jsx";
import {onRequestGet as getLanding} from "../../functions/[slug]/index.jsx";
import {onRequestGet as getHome} from "../../functions/index.jsx";

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

async function setChannelTitle(db, request, title, description = null, image = null) {
  const feedDb = new FeedDb({FEED_DB: db}, request);
  const content = await feedDb.getContent();
  await feedDb._putChannelToContent({
    ...content.channel,
    title,
    ...(description !== null ? {description} : {}),
    ...(image !== null ? {image} : {}),
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

function extractJsonLd(html) {
  const scriptMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return scriptMatch ? JSON.parse(scriptMatch[1]) : null;
}

async function createPhoto(service, itemRepo, title, extra = {}) {
  await service.create("photo", {
    status: "published",
    title,
    image: `https://cdn.example.com/images/${title}.png`,
    ...extra,
  });
  const slug = title.toLowerCase().replace(/\s+/g, "-");
  return itemRepo.getByTypeAndSlug("photo", slug);
}

async function createBlogArticle(service, itemRepo, title, extra = {}) {
  await service.create("blog_article", {
    status: "published",
    title,
    content_html: `<p>${title}</p>`,
    ...extra,
  });
  const slug = title.toLowerCase().replace(/\s+/g, "-");
  return itemRepo.getByTypeAndSlug("blog_article", slug);
}

async function createPodcastEpisode(service, itemRepo, title, extra = {}) {
  await service.create("podcast_episode", {
    status: "published",
    title,
    content_html: `<p>${title}</p>`,
    ...extra,
  });
  const slug = title.toLowerCase().replace(/\s+/g, "-");
  return itemRepo.getByTypeAndSlug("podcast_episode", slug);
}

async function createGallery(service, itemRepo, title, memberIds, extra = {}) {
  await service.create("gallery", {
    status: "published",
    title,
    members: memberIds,
    ...extra,
  });
  const slug = title.toLowerCase().replace(/\s+/g, "-");
  return itemRepo.getByTypeAndSlug("gallery", slug);
}

async function createLandingPage(service, itemRepo, title, extra = {}) {
  await service.create("landing_page", {
    status: "published",
    title,
    ...extra,
  });
  const slug = title.toLowerCase().replace(/\s+/g, "-");
  return itemRepo.getByTypeAndSlug("landing_page", slug);
}

async function createHomePage(service, itemRepo, title, extra = {}) {
  await service.create("home_page", {
    status: "published",
    title,
    ...extra,
  });
  return itemRepo.getByTypeAndSlug("home_page", "home");
}

async function linkRelatedContent(db, parentId, childIds) {
  for (const [position, childId] of childIds.entries()) {
    await db.prepare(
      "INSERT INTO item_relations (parent_item_id, child_item_id, rel_type, position) VALUES (?, ?, ?, ?)",
    ).bind(parentId, childId, "related_content", position).run();
  }
}

describe("aggregator + home web pages", () => {
  test("gallery with 2 ordered member photos renders 200 with both photos in order, linking to /photo/<slug>", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const photoA = await createPhoto(service, itemRepo, "Photo Alpha");
      const photoB = await createPhoto(service, itemRepo, "Photo Beta");

      await createGallery(service, itemRepo, "My Gallery", [photoB.id, photoA.id], {
        content_html: "<p>A curated set</p>",
      });

      const request = new Request("https://site.test/gallery/my-gallery");
      const response = await getGallery({params: {slug: "my-gallery"}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("My Gallery");
      expect(html).toContain("A curated set");

      const betaIndex = html.indexOf("/photo/photo-beta");
      const alphaIndex = html.indexOf("/photo/photo-alpha");
      expect(betaIndex).toBeGreaterThan(-1);
      expect(alphaIndex).toBeGreaterThan(-1);
      expect(betaIndex).toBeLessThan(alphaIndex);
    } finally {
      db.close();
    }
  });

  test("landing page filtering content_types:['blog_article'] includes matching article and excludes non-matching photo", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await createBlogArticle(service, itemRepo, "Matching Article");
      await createPhoto(service, itemRepo, "Excluded Photo");

      await createLandingPage(service, itemRepo, "Blog Landing", {
        content_html: "<p>Latest posts</p>",
        content_types: ["blog_article"],
      });

      const request = new Request("https://site.test/blog-landing");
      const response = await getLanding({params: {slug: "blog-landing"}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Blog Landing");
      expect(html).toContain("Matching Article");
      expect(html).toContain("/blog/matching-article");
      expect(html).not.toContain("Excluded Photo");
      expect(html).not.toContain("/photo/excluded-photo");
    } finally {
      db.close();
    }
  });

  test("landing page with sort:'oldest_first' and limit:1 respects order and limit", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const older = await createBlogArticle(service, itemRepo, "Older Post");
      // Ensure distinct pub_date ordering by explicit date_published_ms.
      await itemRepo.update(older.id, {pub_date: new Date(2020, 0, 1).toISOString()});
      const newer = await createBlogArticle(service, itemRepo, "Newer Post");
      await itemRepo.update(newer.id, {pub_date: new Date(2023, 0, 1).toISOString()});

      await createLandingPage(service, itemRepo, "Sorted Landing", {
        content_types: ["blog_article"],
        sort: "oldest_first",
        limit: 1,
      });

      const request = new Request("https://site.test/sorted-landing");
      const response = await getLanding({params: {slug: "sorted-landing"}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Older Post");
      expect(html).not.toContain("Newer Post");
    } finally {
      db.close();
    }
  });

  test("home page lists recent published record items of all three record types, excludes unpublished", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const request = new Request("https://site.test/");
      await setChannelTitle(db, request, "My Test Feed");

      await createPodcastEpisode(service, itemRepo, "Cast Episode");
      await createBlogArticle(service, itemRepo, "Article One");
      await createPhoto(service, itemRepo, "Photo One");

      await service.create("blog_article", {
        status: "unpublished",
        title: "Hidden Article",
        content_html: "<p>Hidden</p>",
      });

      const response = await getHome({params: {}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("My Test Feed");
      expect(html).toContain("Cast Episode");
      expect(html).toContain("/i/cast-episode");
      expect(html).toContain("Article One");
      expect(html).toContain("/blog/article-one");
      expect(html).toContain("Photo One");
      expect(html).toContain("/photo/photo-one");
      expect(html).not.toContain("Hidden Article");
    } finally {
      db.close();
    }
  });

  test("home page singleton renders hero, channel toggles, and recent/featured/filtered blocks", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const tagService = new TagService(db);
      const request = new Request("https://site.test/");
      await setChannelTitle(db, request, "My Test Feed", "A feed about testing", "https://cdn.example.com/channel.png");

      const featuredTag = await tagService.create({name: "Featured"});
      await createBlogArticle(service, itemRepo, "Featured Story", {
        tags: [featuredTag.id],
        date_published_ms: Date.UTC(2024, 0, 1),
      });
      await createBlogArticle(service, itemRepo, "Filtered Story", {
        tags: [featuredTag.id],
        date_published_ms: Date.UTC(2024, 0, 2),
      });
      const featuredStory = await itemRepo.getByTypeAndSlug("blog_article", "featured-story");

      await service.create("photo", {
        status: "published",
        title: "Recent Photo",
        image: "https://cdn.example.com/images/recent-photo.png",
        taken_date: Date.UTC(2024, 0, 3),
      });

      await createHomePage(service, itemRepo, "Welcome Home", {
        content_html: "<p>Hero body</p>",
        image: "https://cdn.example.com/home.png",
        show_channel_title: true,
        show_channel_description: true,
        show_channel_image: true,
        recent_content_types: ["photo", "blog_article"],
        recent_limit: 1,
        recent_show_date: true,
        recent_show_excerpt: false,
        recent_show_badge: false,
        featured_title: "Featured picks",
        featured_items: [featuredStory.id],
        filtered_title: "Tagged picks",
        content_types: ["blog_article"],
        filter_tags: [featuredTag.id],
        sort: "newest_first",
        limit: 1,
      });

      const response = await getHome({params: {}, env: makeEnv(db), request});
      expect(response.status).toBe(200);
      const html = await response.text();

      expect(html).toContain("Welcome Home");
      expect(html).toContain("Hero body");
      expect(html).toContain("/home.png");
      expect(html).toContain("My Test Feed");
      expect(html).toContain("A feed about testing");
      expect(html).toContain("/channel.png");
      expect(html).toContain("Recent Photo");
      expect(html).toContain("Featured picks");
      expect(html).toContain("Featured Story");
      expect(html).toContain("Tagged picks");
      expect(html).toContain("Filtered Story");
      expect(html).not.toContain("No recent items yet.");
      expect(html).not.toContain("Related content");
    } finally {
      db.close();
    }
  });

  test("unknown gallery slug returns 404", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const request = new Request("https://site.test/gallery/does-not-exist");
      const response = await getGallery({params: {slug: "does-not-exist"}, env: makeEnv(db), request});
      expect(response.status).toBe(404);
    } finally {
      db.close();
    }
  });

  test("unknown landing slug returns 404", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const request = new Request("https://site.test/does-not-exist");
      const response = await getLanding({params: {slug: "does-not-exist"}, env: makeEnv(db), request});
      expect(response.status).toBe(404);
    } finally {
      db.close();
    }
  });

  test("UNPUBLISHED gallery returns 404", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const photo = await createPhoto(service, itemRepo, "Lonely Photo");
      const gallery = await createGallery(service, itemRepo, "Hidden Gallery", [photo.id]);
      await itemRepo.update(gallery.id, {status: 2});

      const request = new Request("https://site.test/gallery/hidden-gallery");
      const response = await getGallery({params: {slug: "hidden-gallery"}, env: makeEnv(db), request});
      expect(response.status).toBe(404);
    } finally {
      db.close();
    }
  });

  test("UNPUBLISHED landing page returns 404", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const landing = await createLandingPage(service, itemRepo, "Hidden Landing");
      await itemRepo.update(landing.id, {status: 2});

      const request = new Request("https://site.test/hidden-landing");
      const response = await getLanding({params: {slug: "hidden-landing"}, env: makeEnv(db), request});
      expect(response.status).toBe(404);
    } finally {
      db.close();
    }
  });

  test("gallery detail page renders the public nav with the Galleries link", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const photo = await createPhoto(service, itemRepo, "Nav Photo");
      await createGallery(service, itemRepo, "Nav Gallery", [photo.id]);

      const request = new Request("https://site.test/gallery/nav-gallery");
      const response = await getGallery({params: {slug: "nav-gallery"}, env: makeEnv(db), request});
      expect(response.status).toBe(200);
      const html = await response.text();
      // A published gallery exists, so the nav must show and include the
      // Galleries listing link on the aggregator detail page.
      expect(html).toContain("public-nav");
      expect(html).toContain('href="/gallery/"');
    } finally {
      db.close();
    }
  });

  test("gallery detail HTML has ImageGallery JSON-LD", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const photo = await createPhoto(service, itemRepo, "Gallery Seo Photo");
      await createGallery(service, itemRepo, "Seo Gallery", [photo.id], {
        content_html: "<p>A curated set</p>",
      });

      const request = new Request("https://site.test/gallery/seo-gallery");
      const response = await getGallery({params: {slug: "seo-gallery"}, env: makeEnv(db), request});
      expect(response.status).toBe(200);
      const html = await response.text();

      const jsonLd = extractJsonLd(html);
      expect(jsonLd).toBeTruthy();
      expect(jsonLd["@type"]).toBe("ImageGallery");
      expect(jsonLd.name).toBe("Seo Gallery");
    } finally {
      db.close();
    }
  });

  test("home page HTML has WebSite JSON-LD with publisher", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const request = new Request("https://site.test/");
      await setChannelTitle(db, request, "My SEO Feed");
      await setSeoSettings(db, request, {publisherType: "Organization", publisherName: "My SEO Feed Org"});

      await createBlogArticle(service, itemRepo, "Home Seo Article");

      const response = await getHome({params: {}, env: makeEnv(db), request});
      expect(response.status).toBe(200);
      const html = await response.text();

      expect(html).toContain('property="og:title"');
      const jsonLd = extractJsonLd(html);
      expect(jsonLd).toBeTruthy();
      expect(jsonLd["@type"]).toBe("WebSite");
      expect(jsonLd.publisher).toMatchObject({"@type": "Organization", name: "My SEO Feed Org"});
    } finally {
      db.close();
    }
  });

  test("gallery page renders the shared Read next strip for related items", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const relatedBlog = await createBlogArticle(service, itemRepo, "Gallery Related Blog");
      const relatedPhoto = await createPhoto(service, itemRepo, "Gallery Related Photo");

      const gallery = await createGallery(service, itemRepo, "Gallery Strip Source", [], {
        content_html: "<p>A curated set</p>",
      });
      await linkRelatedContent(db, gallery.id, [relatedBlog.id, relatedPhoto.id]);

      const request = new Request("https://site.test/gallery/gallery-strip-source");
      const response = await getGallery({params: {slug: "gallery-strip-source"}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Read next");
      expect(html).toContain("Gallery Related Blog");
      expect(html).toContain("Gallery Related Photo");
      expect(html).toContain("class=\"item-card\"");
    } finally {
      db.close();
    }
  });

  test("landing page renders the shared Read next strip for related items", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      const relatedBlog = await createBlogArticle(service, itemRepo, "Landing Related Blog");
      const relatedPhoto = await createPhoto(service, itemRepo, "Landing Related Photo");

      const landing = await createLandingPage(service, itemRepo, "Landing Strip Source", {
        content_html: "<p>Landing intro</p>",
        content_types: ["blog_article", "photo"],
      });
      await linkRelatedContent(db, landing.id, [relatedBlog.id, relatedPhoto.id]);

      const request = new Request("https://site.test/landing-strip-source");
      const response = await getLanding({params: {slug: "landing-strip-source"}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Read next");
      expect(html).toContain("Landing Related Blog");
      expect(html).toContain("Landing Related Photo");
      expect(html).toContain("class=\"item-card\"");
    } finally {
      db.close();
    }
  });
});
