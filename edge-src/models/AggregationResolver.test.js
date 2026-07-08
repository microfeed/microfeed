import AggregationResolver from "./AggregationResolver";
import ContentService from "./ContentService";
import ItemRepo from "./ItemRepo";
import {RELATED_CONTENT} from "./RelationRepo";
import TagService from "./TagService";
import {STATUSES} from "../../common-src/Constants";

const {createMigratedInMemoryDatabase} = require("../../test-utils/d1-substitute");

function makeContentService(db) {
  const itemRepo = new ItemRepo(db);
  return new ContentService({}, {itemRepo}, {url: "https://example.com/"});
}

async function createPhoto(contentService, itemRepo, title, extra = {}) {
  await contentService.create("photo", {
    status: "published",
    title,
    image: `https://cdn.example.com/images/${title}.png`,
    ...extra,
  });
  const row = await itemRepo.getByTypeAndSlug("photo", title.toLowerCase().replace(/\s+/g, "-"));
  return row.id;
}

async function createBlogArticle(contentService, itemRepo, title, extra = {}) {
  await contentService.create("blog_article", {
    status: "published",
    title,
    content_html: `<p>${title}</p>`,
    ...extra,
  });
  const row = await itemRepo.getByTypeAndSlug("blog_article", title.toLowerCase().replace(/\s+/g, "-"));
  return row.id;
}

async function createLandingPage(contentService, itemRepo, title, extra = {}) {
  await contentService.create("landing_page", {
    status: "published",
    title,
    ...extra,
  });
  const row = await itemRepo.getByTypeAndSlug("landing_page", title.toLowerCase().replace(/\s+/g, "-"));
  return row;
}

async function createGallery(contentService, itemRepo, title, memberIds) {
  await contentService.create("gallery", {
    status: "published",
    title,
    members: memberIds,
  });
  const row = await itemRepo.getByTypeAndSlug("gallery", title.toLowerCase().replace(/\s+/g, "-"));
  return row;
}

describe("AggregationResolver", () => {
  test("gallery resolve returns member photos in member order, excluding non-matching statuses", async () => {
    const db = createMigratedInMemoryDatabase();
    const itemRepo = new ItemRepo(db);
    const contentService = makeContentService(db);
    const resolver = new AggregationResolver(db);

    try {
      const photo1 = await createPhoto(contentService, itemRepo, "Photo One");
      const photo2 = await createPhoto(contentService, itemRepo, "Photo Two");
      const photo3 = await createPhoto(contentService, itemRepo, "Photo Three");

      // Set photo2 to unpublished so it should be excluded when filtering on published status.
      await itemRepo.update(photo2, {status: STATUSES.UNPUBLISHED});

      const galleryRow = await createGallery(contentService, itemRepo, "My Gallery", [
        photo3,
        photo1,
        photo2,
      ]);

      const resolved = await resolver.resolve(galleryRow);

      expect(resolved.map((row) => row.id)).toEqual([photo3, photo1]);
    } finally {
      db.close();
    }
  });

  test("gallery resolve with no members returns an empty array", async () => {
    const db = createMigratedInMemoryDatabase();
    const itemRepo = new ItemRepo(db);
    const contentService = makeContentService(db);
    const resolver = new AggregationResolver(db);

    try {
      const galleryRow = await createGallery(contentService, itemRepo, "Empty Gallery", []);
      const resolved = await resolver.resolve(galleryRow);
      expect(resolved).toEqual([]);
    } finally {
      db.close();
    }
  });

  test("landing resolve by content_types returns only published items of the allowed types", async () => {
    const db = createMigratedInMemoryDatabase();
    const itemRepo = new ItemRepo(db);
    const contentService = makeContentService(db);
    const resolver = new AggregationResolver(db);

    try {
      const blog1 = await createBlogArticle(contentService, itemRepo, "Blog One");
      const blog2 = await createBlogArticle(contentService, itemRepo, "Blog Two");
      await createPhoto(contentService, itemRepo, "Unrelated Photo");

      // blog2 is unpublished -> should be excluded by default statuses filter.
      await itemRepo.update(blog2, {status: STATUSES.UNPUBLISHED});

      const landingRow = await createLandingPage(contentService, itemRepo, "Blog Landing", {
        content_types: ["blog_article"],
      });

      const resolved = await resolver.resolve(landingRow);

      expect(resolved.map((row) => row.id)).toEqual([blog1]);
      expect(resolved.every((row) => row.content_type === "blog_article")).toBe(true);
    } finally {
      db.close();
    }
  });

  test("landing resolve by filter_tags returns only items linked to that tag, across allowed types", async () => {
    const db = createMigratedInMemoryDatabase();
    const itemRepo = new ItemRepo(db);
    const contentService = makeContentService(db);
    const tagService = new TagService(db);
    const resolver = new AggregationResolver(db);

    try {
      const tag1 = await tagService.create({name: "featured"});
      await tagService.create({name: "other"});

      const blog1 = await createBlogArticle(contentService, itemRepo, "Tagged Blog", {tags: [tag1.id]});
      await createBlogArticle(contentService, itemRepo, "Untagged Blog");
      const photo1 = await createPhoto(contentService, itemRepo, "Tagged Photo", {tags: [tag1.id]});
      await createPhoto(contentService, itemRepo, "Untagged Photo");

      const landingRow = await createLandingPage(contentService, itemRepo, "Featured Landing", {
        filter_tags: [tag1.id],
      });

      const resolved = await resolver.resolve(landingRow);
      const resolvedIds = resolved.map((row) => row.id).sort();

      expect(resolvedIds).toEqual([blog1, photo1].sort());
    } finally {
      db.close();
    }
  });

  test("landing resolve by content_types + filter_tags + sort oldest_first + limit respects all four", async () => {
    const db = createMigratedInMemoryDatabase();
    const itemRepo = new ItemRepo(db);
    const contentService = makeContentService(db);
    const tagService = new TagService(db);
    const resolver = new AggregationResolver(db);

    try {
      const tag1 = await tagService.create({name: "featured"});

      const blogA = await createBlogArticle(contentService, itemRepo, "Blog A", {
        tags: [tag1.id],
        date_published_ms: 1000,
      });
      const blogB = await createBlogArticle(contentService, itemRepo, "Blog B", {
        tags: [tag1.id],
        date_published_ms: 2000,
      });
      const blogC = await createBlogArticle(contentService, itemRepo, "Blog C", {
        tags: [tag1.id],
        date_published_ms: 3000,
      });
      // Photo has the tag too, but content_types restricts to blog_article only.
      await createPhoto(contentService, itemRepo, "Photo With Tag", {tags: [tag1.id]});

      const landingRow = await createLandingPage(contentService, itemRepo, "Combined Landing", {
        content_types: ["blog_article"],
        filter_tags: [tag1.id],
        sort: "oldest_first",
        limit: 2,
      });

      const resolved = await resolver.resolve(landingRow);

      expect(resolved.map((row) => row.id)).toEqual([blogA, blogB]);
      expect(resolved.length).toBe(2);
      void blogC;
    } finally {
      db.close();
    }
  });

  test("landing resolve with a filter matching nothing returns an empty array", async () => {
    const db = createMigratedInMemoryDatabase();
    const itemRepo = new ItemRepo(db);
    const contentService = makeContentService(db);
    const tagService = new TagService(db);
    const resolver = new AggregationResolver(db);

    try {
      const tag1 = await tagService.create({name: "unused-tag"});
      await createBlogArticle(contentService, itemRepo, "Some Blog");

      const landingRow = await createLandingPage(contentService, itemRepo, "No Match Landing", {
        content_types: ["blog_article"],
        filter_tags: [tag1.id],
      });

      const resolved = await resolver.resolve(landingRow);
      expect(resolved).toEqual([]);
    } finally {
      db.close();
    }
  });

  test("resolveFilter resolves a landing-style filter config without a saved row, matching resolve() on an equivalent landing_page", async () => {
    const db = createMigratedInMemoryDatabase();
    const itemRepo = new ItemRepo(db);
    const contentService = makeContentService(db);
    const tagService = new TagService(db);
    const resolver = new AggregationResolver(db);

    try {
      const tag1 = await tagService.create({name: "featured"});

      const blogA = await createBlogArticle(contentService, itemRepo, "Blog A", {
        tags: [tag1.id],
        date_published_ms: 1000,
      });
      const blogB = await createBlogArticle(contentService, itemRepo, "Blog B", {
        tags: [tag1.id],
        date_published_ms: 2000,
      });
      await createPhoto(contentService, itemRepo, "Photo With Tag", {tags: [tag1.id]});

      const filterConfig = {
        content_types: ["blog_article"],
        filter_tags: [tag1.id],
        sort: "oldest_first",
        limit: 2,
      };

      const landingRow = await createLandingPage(contentService, itemRepo, "Combined Landing 2", filterConfig);

      const viaResolve = await resolver.resolve(landingRow);
      const viaResolveFilter = await resolver.resolveFilter(filterConfig);

      expect(viaResolveFilter.map((row) => row.id)).toEqual([blogA, blogB]);
      expect(viaResolveFilter.map((row) => row.id)).toEqual(viaResolve.map((row) => row.id));
    } finally {
      db.close();
    }
  });

  test("resolveFilter respects a custom statuses list", async () => {
    const db = createMigratedInMemoryDatabase();
    const itemRepo = new ItemRepo(db);
    const contentService = makeContentService(db);
    const resolver = new AggregationResolver(db);

    try {
      const blog1 = await createBlogArticle(contentService, itemRepo, "Unlisted Blog");
      await itemRepo.update(blog1, {status: STATUSES.UNLISTED});

      const resolvedDefault = await resolver.resolveFilter({content_types: ["blog_article"]});
      expect(resolvedDefault).toEqual([]);

      const resolvedWithUnlisted = await resolver.resolveFilter(
        {content_types: ["blog_article"]},
        {statuses: [STATUSES.PUBLISHED, STATUSES.UNLISTED]},
      );
      expect(resolvedWithUnlisted.map((row) => row.id)).toEqual([blog1]);
    } finally {
      db.close();
    }
  });

  test("any other content_type resolves to an empty array", async () => {
    const db = createMigratedInMemoryDatabase();
    const itemRepo = new ItemRepo(db);
    const contentService = makeContentService(db);
    const resolver = new AggregationResolver(db);

    try {
      const photoId = await createPhoto(contentService, itemRepo, "Just A Photo");
      const photoRow = await itemRepo.getById(photoId);

      const resolved = await resolver.resolve(photoRow);
      expect(resolved).toEqual([]);
    } finally {
      db.close();
    }
  });

  test("related content resolve returns published non-home items in updated_at order, caps at 3, and includes reverse links", async () => {
    const db = createMigratedInMemoryDatabase();
    const itemRepo = new ItemRepo(db);
    const contentService = makeContentService(db);
    const resolver = new AggregationResolver(db);

    try {
      const sourceId = await createBlogArticle(contentService, itemRepo, "Source Post");
      const outgoingPhoto = await createPhoto(contentService, itemRepo, "Outgoing Photo");
      await contentService.update(outgoingPhoto, {title: "Outgoing Photo Updated"});

      const outgoingGallery = await createGallery(contentService, itemRepo, "Outgoing Gallery", []);
      await contentService.update(outgoingGallery.id, {title: "Outgoing Gallery Updated"});

      const outgoingLanding = await createLandingPage(contentService, itemRepo, "Outgoing Landing", {});
      await contentService.update(outgoingLanding.id, {title: "Outgoing Landing Updated"});

      const incomingOnlyBlog = await createBlogArticle(contentService, itemRepo, "Incoming Only Blog");
      await contentService.update(incomingOnlyBlog, {title: "Incoming Only Blog Updated"});

      const hiddenRelated = await createBlogArticle(contentService, itemRepo, "Hidden Related");
      await itemRepo.update(hiddenRelated, {status: STATUSES.UNPUBLISHED});

      const homeId = await contentService.create("home_page", {
        status: "published",
        title: "Home",
      });

      await db.prepare(
        "INSERT INTO item_relations (parent_item_id, child_item_id, rel_type, position) VALUES (?, ?, ?, ?)",
      ).bind(sourceId, outgoingPhoto, RELATED_CONTENT, 0).run();
      await db.prepare(
        "INSERT INTO item_relations (parent_item_id, child_item_id, rel_type, position) VALUES (?, ?, ?, ?)",
      ).bind(sourceId, outgoingGallery.id, RELATED_CONTENT, 1).run();
      await db.prepare(
        "INSERT INTO item_relations (parent_item_id, child_item_id, rel_type, position) VALUES (?, ?, ?, ?)",
      ).bind(sourceId, outgoingLanding.id, RELATED_CONTENT, 2).run();
      await db.prepare(
        "INSERT INTO item_relations (parent_item_id, child_item_id, rel_type, position) VALUES (?, ?, ?, ?)",
      ).bind(incomingOnlyBlog, sourceId, RELATED_CONTENT, 0).run();
      await db.prepare(
        "INSERT INTO item_relations (parent_item_id, child_item_id, rel_type, position) VALUES (?, ?, ?, ?)",
      ).bind(sourceId, hiddenRelated, RELATED_CONTENT, 3).run();
      await db.prepare(
        "INSERT INTO item_relations (parent_item_id, child_item_id, rel_type, position) VALUES (?, ?, ?, ?)",
      ).bind(sourceId, homeId, RELATED_CONTENT, 4).run();

      const sourceRow = await itemRepo.getById(sourceId);
      const resolved = await resolver.resolveRelated(sourceRow);

      expect(resolved.map((row) => row.id)).toEqual([
        incomingOnlyBlog,
        outgoingLanding.id,
        outgoingGallery.id,
      ]);
      expect(resolved).toHaveLength(3);
      expect(resolved.every((row) => row.status === STATUSES.PUBLISHED)).toBe(true);
      expect(resolved.every((row) => row.content_type !== "home_page")).toBe(true);
    } finally {
      db.close();
    }
  });
});
