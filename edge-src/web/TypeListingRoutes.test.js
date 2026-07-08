const {createMigratedInMemoryDatabase} = require("../../test-utils/d1-substitute");
import ContentService from "../models/ContentService";
import ItemRepo from "../models/ItemRepo";

import {onRequestGet as getBlogListing} from "../../functions/blog/index.jsx";
import {onRequestGet as getPhotoListing} from "../../functions/photo/index.jsx";
import {onRequestGet as getPodcastListing} from "../../functions/i/index.jsx";
import {onRequestGet as getGalleryListing} from "../../functions/gallery/index.jsx";

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

describe("type listing routes", () => {
  test("/blog/ returns 200 HTML listing only PUBLISHED blog_article items, with nav populated", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("blog_article", {
        status: "published",
        title: "Visible Article",
        content_html: "<p>Body</p>",
      });
      await service.create("blog_article", {
        status: "unpublished",
        title: "Hidden Article",
        content_html: "<p>Body</p>",
      });
      await service.create("photo", {
        status: "published",
        title: "Some Photo",
        image: "https://cdn.example.com/photo.png",
      });

      const request = new Request("https://site.test/blog/");
      const response = await getBlogListing({params: {}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Visible Article");
      expect(html).toContain("/blog/visible-article");
      expect(html).not.toContain("Hidden Article");
      expect(html).not.toContain("Some Photo");
      // nav populated: both blog and photo have published items
      expect(html).toContain("/photo/");
    } finally {
      db.close();
    }
  });

  test("/photo/ returns 200 HTML listing only PUBLISHED photo items", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("photo", {
        status: "published",
        title: "Visible Photo",
        image: "https://cdn.example.com/visible.png",
      });
      await service.create("photo", {
        status: "unpublished",
        title: "Hidden Photo",
        image: "https://cdn.example.com/hidden.png",
      });

      const request = new Request("https://site.test/photo/");
      const response = await getPhotoListing({params: {}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Visible Photo");
      expect(html).toContain("/photo/visible-photo");
      expect(html).not.toContain("Hidden Photo");
    } finally {
      db.close();
    }
  });

  test("/i/ returns 200 HTML listing only PUBLISHED podcast_episode items", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("podcast_episode", {
        status: "published",
        title: "Visible Episode",
        content_html: "<p>Notes</p>",
      });
      await service.create("podcast_episode", {
        status: "unpublished",
        title: "Hidden Episode",
        content_html: "<p>Notes</p>",
      });

      const request = new Request("https://site.test/i/");
      const response = await getPodcastListing({params: {}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Visible Episode");
      expect(html).toContain("/i/visible-episode");
      expect(html).not.toContain("Hidden Episode");
    } finally {
      db.close();
    }
  });

  test("/blog/ shows empty state when there are no published blog articles", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const request = new Request("https://site.test/blog/");
      const response = await getBlogListing({params: {}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html.toLowerCase()).toContain("no items yet");
    } finally {
      db.close();
    }
  });

  test("/gallery/ returns 200 HTML listing only PUBLISHED galleries, with nav populated", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("photo", {
        status: "published",
        title: "Alpha",
        image: "https://cdn.example.com/alpha.png",
      });
      const photo = await itemRepo.getByTypeAndSlug("photo", "alpha");
      await service.create("gallery", {
        status: "published",
        title: "Visible Gallery",
        image: "https://cdn.example.com/cover.png",
        members: [photo.id],
      });
      await service.create("gallery", {
        status: "unpublished",
        title: "Hidden Gallery",
        members: [photo.id],
      });

      const request = new Request("https://site.test/gallery/");
      const response = await getGalleryListing({params: {}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Visible Gallery");
      expect(html).toContain("/gallery/visible-gallery");
      expect(html).not.toContain("Hidden Gallery");
      // nav populated: the Galleries link itself should appear.
      expect(html).toContain("/gallery/");
    } finally {
      db.close();
    }
  });

  test("/gallery/ shows empty state when there are no published galleries", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const request = new Request("https://site.test/gallery/");
      const response = await getGalleryListing({params: {}, env: makeEnv(db), request});

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html.toLowerCase()).toContain("no items yet");
    } finally {
      db.close();
    }
  });
});
