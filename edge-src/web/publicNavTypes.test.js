const {createMigratedInMemoryDatabase} = require("../../test-utils/d1-substitute");
import ContentService from "../models/ContentService";
import ItemRepo from "../models/ItemRepo";
import {getPublicNavTypes, getPublicNavLinks} from "./publicNavTypes";

function makeContentService(db) {
  const itemRepo = new ItemRepo(db);
  return {
    itemRepo,
    service: new ContentService({}, {itemRepo}, {url: "https://example.com/"}),
  };
}

describe("getPublicNavTypes", () => {
  test("returns only record types with >=1 published item, with correct label + href", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("blog_article", {
        status: "published",
        title: "Hello World",
        content_html: "<p>Body</p>",
      });

      const navTypes = await getPublicNavTypes(itemRepo);

      expect(navTypes).toEqual([
        {name: "blog_article", label: "Blog", href: "/blog/"},
      ]);
    } finally {
      db.close();
    }
  });

  test("excludes record types with zero published items", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("blog_article", {
        status: "unpublished",
        title: "Hidden",
        content_html: "<p>Body</p>",
      });
      await service.create("photo", {
        status: "published",
        title: "Sunset",
        image: "https://cdn.example.com/sunset.png",
      });

      const navTypes = await getPublicNavTypes(itemRepo);

      expect(navTypes).toEqual([
        {name: "photo", label: "Photos", href: "/photo/"},
      ]);
    } finally {
      db.close();
    }
  });

  test("excludes aggregator types (gallery, landing_page) even if published", async () => {
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
        title: "My Gallery",
        members: [photo.id],
      });
      await service.create("landing_page", {
        status: "published",
        title: "My Landing",
      });

      const navTypes = await getPublicNavTypes(itemRepo);

      expect(navTypes.map((entry) => entry.name)).toEqual(["photo"]);
    } finally {
      db.close();
    }
  });

  test("returns all three record type entries, in a stable order, when all have published items", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("podcast_episode", {
        status: "published",
        title: "Episode One",
        content_html: "<p>Notes</p>",
      });
      await service.create("blog_article", {
        status: "published",
        title: "Article One",
        content_html: "<p>Body</p>",
      });
      await service.create("photo", {
        status: "published",
        title: "Photo One",
        image: "https://cdn.example.com/photo-one.png",
      });

      const navTypes = await getPublicNavTypes(itemRepo);

      expect(navTypes).toEqual([
        {name: "podcast_episode", label: "Podcast", href: "/i/"},
        {name: "blog_article", label: "Blog", href: "/blog/"},
        {name: "photo", label: "Photos", href: "/photo/"},
      ]);
    } finally {
      db.close();
    }
  });

  test("returns an empty array when there are no published record items", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const itemRepo = new ItemRepo(db);
      const navTypes = await getPublicNavTypes(itemRepo);
      expect(navTypes).toEqual([]);
    } finally {
      db.close();
    }
  });
});

describe("getPublicNavLinks", () => {
  test("omits the Galleries link and landing links when none exist", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("blog_article", {
        status: "published",
        title: "Hello World",
        content_html: "<p>Body</p>",
      });

      const links = await getPublicNavLinks(itemRepo);

      expect(links).toEqual([
        {name: "blog_article", label: "Blog", href: "/blog/"},
      ]);
    } finally {
      db.close();
    }
  });

  test("includes the Galleries link only when >=1 published gallery exists", async () => {
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
        title: "My Gallery",
        members: [photo.id],
      });

      const links = await getPublicNavLinks(itemRepo);

      expect(links).toEqual([
        {name: "photo", label: "Photos", href: "/photo/"},
        {name: "gallery", label: "Galleries", href: "/gallery/"},
      ]);
    } finally {
      db.close();
    }
  });

  test("excludes the Galleries link when galleries exist but are unpublished", async () => {
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
        status: "unpublished",
        title: "Hidden Gallery",
        members: [photo.id],
      });

      const links = await getPublicNavLinks(itemRepo);

      expect(links.map((link) => link.name)).not.toContain("gallery");
    } finally {
      db.close();
    }
  });

  test("includes only published landing pages flagged show_in_nav, labeled by title, linking to /<slug>", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("landing_page", {
        status: "published",
        title: "Flagged Page",
        showInNav: true,
      });
      await service.create("landing_page", {
        status: "published",
        title: "Unflagged Page",
      });
      await service.create("landing_page", {
        status: "unpublished",
        title: "Hidden Flagged Page",
        showInNav: true,
      });

      const links = await getPublicNavLinks(itemRepo);

      expect(links).toEqual([
        {name: "landing:flagged-page", label: "Flagged Page", href: "/flagged-page"},
      ]);
    } finally {
      db.close();
    }
  });

  test("orders record-type links, then Galleries, then flagged landing pages", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const {itemRepo, service} = makeContentService(db);
      await service.create("blog_article", {
        status: "published",
        title: "Article",
        content_html: "<p>Body</p>",
      });
      await service.create("photo", {
        status: "published",
        title: "Alpha",
        image: "https://cdn.example.com/alpha.png",
      });
      const photo = await itemRepo.getByTypeAndSlug("photo", "alpha");
      await service.create("gallery", {
        status: "published",
        title: "My Gallery",
        members: [photo.id],
      });
      await service.create("landing_page", {
        status: "published",
        title: "Flagged Page",
        showInNav: true,
      });

      const links = await getPublicNavLinks(itemRepo);

      expect(links).toEqual([
        {name: "blog_article", label: "Blog", href: "/blog/"},
        {name: "photo", label: "Photos", href: "/photo/"},
        {name: "gallery", label: "Galleries", href: "/gallery/"},
        {name: "landing:flagged-page", label: "Flagged Page", href: "/flagged-page"},
      ]);
    } finally {
      db.close();
    }
  });

  test("returns an empty array when nothing is published", async () => {
    const db = createMigratedInMemoryDatabase();
    try {
      const itemRepo = new ItemRepo(db);
      const links = await getPublicNavLinks(itemRepo);
      expect(links).toEqual([]);
    } finally {
      db.close();
    }
  });
});
