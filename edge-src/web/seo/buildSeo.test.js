import {siteSeo, recordSeo, aggregatorSeo, listingSeo, pageDescription} from "./buildSeo";
import {STATUSES} from "../../../common-src/Constants";

const CHANNEL = {
  title: "My Test Feed",
  description: "A feed about testing things.",
  image: "https://cdn.example.com/channel.png",
  link: "https://example.com/",
};

const SEO_SETTINGS = {
  siteName: "Test Site",
  defaultShareImage: {url: "https://cdn.example.com/default-share.png", contentType: "image/png"},
  keyTerms: "testing, quality, software",
  publisherType: "Organization",
  publisherName: "Test Org",
  publisherLogo: {url: "https://cdn.example.com/logo.png", contentType: "image/png"},
  sameAs: ["https://twitter.com/testorg", "https://github.com/testorg"],
  twitterHandle: "@testorg",
};

describe("pageDescription", () => {
  test("prefers seoDescription over other sources", () => {
    const desc = pageDescription({
      seoDescription: "Override description",
      excerpt: "Excerpt text",
      caption: "Caption text",
      contentHtml: "<p>Body</p>",
      fallback: "Fallback",
    });
    expect(desc).toBe("Override description");
  });

  test("falls back to excerpt, then caption, then stripped content_html, then fallback", () => {
    expect(pageDescription({excerpt: "Excerpt text", fallback: "Fallback"})).toBe("Excerpt text");
    expect(pageDescription({caption: "Caption text", fallback: "Fallback"})).toBe("Caption text");
    expect(pageDescription({contentHtml: "<p>Plain body</p>", fallback: "Fallback"})).toBe("Plain body");
    expect(pageDescription({fallback: "Fallback description"})).toBe("Fallback description");
  });

  test("strips HTML tags from content_html-derived descriptions", () => {
    const desc = pageDescription({contentHtml: "<p>Hello <strong>World</strong></p>", fallback: ""});
    expect(desc).toBe("Hello World");
  });
});

describe("siteSeo", () => {
  test("returns WebSite JSON-LD with publisher Organization node incl sameAs+logo", () => {
    const seo = siteSeo({channel: CHANNEL, seoSettings: SEO_SETTINGS, canonicalUrl: "https://example.com/"});

    expect(seo.title).toBe("Test Site");
    expect(seo.description).toBe("A feed about testing things.");
    expect(seo.canonicalUrl).toBe("https://example.com/");
    expect(seo.siteName).toBe("Test Site");
    expect(seo.twitterHandle).toBe("@testorg");
    expect(seo.image).toBe("https://cdn.example.com/default-share.png");
    expect(seo.keywords).toEqual(expect.arrayContaining(["testing", "quality", "software"]));
    expect(seo.noindex).toBe(false);

    expect(seo.jsonLd["@type"]).toBe("WebSite");
    expect(seo.jsonLd.name).toBe("Test Site");
    expect(seo.jsonLd.url).toBe("https://example.com/");
    const publisher = seo.jsonLd.publisher;
    expect(publisher["@type"]).toBe("Organization");
    expect(publisher.name).toBe("Test Org");
    expect(publisher.sameAs).toEqual(SEO_SETTINGS.sameAs);
    expect(publisher.logo).toMatchObject({"@type": "ImageObject", url: "https://cdn.example.com/logo.png"});
  });

  test("publisherType Person renders Person node without logo requirement", () => {
    const seo = siteSeo({
      channel: CHANNEL,
      seoSettings: {...SEO_SETTINGS, publisherType: "Person", publisherName: "Jane Doe", publisherLogo: undefined},
      canonicalUrl: "https://example.com/",
    });
    expect(seo.jsonLd.publisher["@type"]).toBe("Person");
    expect(seo.jsonLd.publisher.name).toBe("Jane Doe");
  });

  test("falls back to channel title/description/image when seoSettings sparse", () => {
    const seo = siteSeo({channel: CHANNEL, seoSettings: {}, canonicalUrl: "https://example.com/"});
    expect(seo.title).toBe("My Test Feed");
    expect(seo.description).toBe("A feed about testing things.");
    expect(seo.image).toBe("https://cdn.example.com/channel.png");
    expect(seo.jsonLd.publisher["@type"]).toBe("Organization");
    expect(seo.jsonLd.publisher.name).toBe("My Test Feed");
  });

  test("homePage overrides description, image, and noindex when present", () => {
    const seo = siteSeo({
      channel: CHANNEL,
      homePage: {
        title: "Welcome Home",
        content_html: "<p>Home body</p>",
        image: "https://cdn.example.com/home.png",
        share_image: "https://cdn.example.com/home-share.png",
        status: "unlisted",
      },
      seoSettings: {},
      canonicalUrl: "https://example.com/",
    });

    expect(seo.title).toBe("My Test Feed");
    expect(seo.description).toBe("Home body");
    expect(seo.image).toBe("https://cdn.example.com/home-share.png");
    expect(seo.noindex).toBe(true);
    expect(seo.jsonLd.name).toBe("My Test Feed");
  });
});

describe("recordSeo", () => {
  const publicBucketUrl = "https://cdn.example.com";

  test("blog_article -> BlogPosting with required props + BreadcrumbList", () => {
    const item = {
      title: "Hello World",
      content_html: "<p>Body copy here</p>",
      author: "Ada Lovelace",
      image: "https://cdn.example.com/cover.png",
      date_published_ms: Date.UTC(2024, 0, 15),
      tags: ["news", "tech"],
      slug: "hello-world",
      content_type: "blog_article",
    };
    const seo = recordSeo({
      item,
      contentType: "blog_article",
      channel: CHANNEL,
      seoSettings: SEO_SETTINGS,
      publicBucketUrl,
      canonicalUrl: "https://example.com/blog/hello-world/",
    });

    expect(seo.title).toBe("Hello World");
    expect(seo.description).toBe("Body copy here");
    expect(seo.image).toBe("https://cdn.example.com/cover.png");
    expect(seo.ogType).toBe("article");
    expect(seo.publishedTime).toBe(new Date(Date.UTC(2024, 0, 15)).toISOString());
    expect(seo.author).toBe("Ada Lovelace");
    expect(seo.keywords).toEqual(expect.arrayContaining(["news", "tech", "testing"]));
    expect(seo.noindex).toBe(false);

    expect(seo.jsonLd["@type"]).toBe("BlogPosting");
    expect(seo.jsonLd.headline).toBe("Hello World");
    expect(seo.jsonLd.description).toBe("Body copy here");
    expect(seo.jsonLd.image).toBe("https://cdn.example.com/cover.png");
    expect(seo.jsonLd.datePublished).toBe(new Date(Date.UTC(2024, 0, 15)).toISOString());
    expect(seo.jsonLd.author).toMatchObject({"@type": "Person", name: "Ada Lovelace"});
    expect(seo.jsonLd.publisher).toMatchObject({"@type": "Organization", name: "Test Org"});
    expect(seo.jsonLd.mainEntityOfPage).toMatchObject({"@type": "WebPage", "@id": "https://example.com/blog/hello-world/"});

    // BreadcrumbList is emitted as a separate node (its own ld+json script),
    // not embedded in the primary entity's @graph.
    expect(seo.jsonLd["@graph"]).toBeUndefined();
    expect(seo.breadcrumb).toMatchObject({"@type": "BreadcrumbList"});
    expect(seo.breadcrumb.itemListElement.length).toBeGreaterThanOrEqual(2);
  });

  test("blog_article seoTitle/seoDescription/shareImage overrides win over derived values", () => {
    const item = {
      title: "Hello World",
      seoTitle: "Custom SEO Title",
      seoDescription: "Custom SEO description",
      shareImage: "https://cdn.example.com/share-override.png",
      content_html: "<p>Body copy here</p>",
      image: "https://cdn.example.com/cover.png",
      slug: "hello-world",
      content_type: "blog_article",
    };
    const seo = recordSeo({
      item,
      contentType: "blog_article",
      channel: CHANNEL,
      seoSettings: SEO_SETTINGS,
      publicBucketUrl,
      canonicalUrl: "https://example.com/blog/hello-world/",
    });
    expect(seo.title).toBe("Custom SEO Title");
    expect(seo.description).toBe("Custom SEO description");
    expect(seo.image).toBe("https://cdn.example.com/share-override.png");
  });

  test("noindex true on item forces noindex", () => {
    const item = {title: "X", content_html: "<p>Y</p>", slug: "x", content_type: "blog_article", noindex: true};
    const seo = recordSeo({item, contentType: "blog_article", channel: CHANNEL, seoSettings: SEO_SETTINGS, publicBucketUrl, canonicalUrl: "https://example.com/blog/x/"});
    expect(seo.noindex).toBe(true);
  });

  test("UNLISTED status forces noindex", () => {
    const item = {title: "X", content_html: "<p>Y</p>", slug: "x", content_type: "blog_article", status: STATUSES.UNLISTED};
    const seo = recordSeo({item, contentType: "blog_article", channel: CHANNEL, seoSettings: SEO_SETTINGS, publicBucketUrl, canonicalUrl: "https://example.com/blog/x/"});
    expect(seo.noindex).toBe(true);
  });

  test("podcast_episode -> PodcastEpisode with AudioObject + PodcastSeries", () => {
    const item = {
      title: "Episode One",
      content_html: "<p>Show notes</p>",
      image: "https://cdn.example.com/ep1.png",
      date_published_ms: Date.UTC(2024, 2, 1),
      attachment: {category: "audio", url: "https://cdn.example.com/ep1.mp3", mime_type: "audio/mpeg"},
      slug: "episode-one",
      content_type: "podcast_episode",
    };
    const seo = recordSeo({
      item,
      contentType: "podcast_episode",
      channel: CHANNEL,
      seoSettings: SEO_SETTINGS,
      publicBucketUrl,
      canonicalUrl: "https://example.com/i/episode-one/",
    });

    expect(seo.jsonLd["@type"]).toBe("PodcastEpisode");
    expect(seo.jsonLd.name).toBe("Episode One");
    expect(seo.jsonLd.associatedMedia).toMatchObject({"@type": "AudioObject", contentUrl: "https://cdn.example.com/ep1.mp3"});
    expect(seo.jsonLd.partOfSeries).toMatchObject({"@type": "PodcastSeries", name: "Test Site"});
    expect(seo.jsonLd.datePublished).toBe(new Date(Date.UTC(2024, 2, 1)).toISOString());
  });

  test("photo -> Photograph/ImageObject with caption + taken_date author", () => {
    const item = {
      title: "Sunset",
      caption: "A beautiful sunset",
      image: "https://cdn.example.com/sunset.png",
      date_published_ms: Date.UTC(2024, 5, 10),
      slug: "sunset",
      content_type: "photo",
    };
    const seo = recordSeo({
      item,
      contentType: "photo",
      channel: CHANNEL,
      seoSettings: SEO_SETTINGS,
      publicBucketUrl,
      canonicalUrl: "https://example.com/photo/sunset/",
    });

    expect(["Photograph", "ImageObject"]).toContain(seo.jsonLd["@type"]);
    expect(seo.jsonLd.contentUrl).toBe("https://cdn.example.com/sunset.png");
    expect(seo.jsonLd.caption).toBe("A beautiful sunset");
    expect(seo.jsonLd.datePublished).toBe(new Date(Date.UTC(2024, 5, 10)).toISOString());
    expect(seo.description).toBe("A beautiful sunset");
  });

  test("image is absolute via publicBucketUrl join when item.image is bucket-relative", () => {
    const item = {
      title: "Sunset",
      caption: "A beautiful sunset",
      image: "production/images/sunset.png",
      slug: "sunset",
      content_type: "photo",
    };
    const seo = recordSeo({
      item,
      contentType: "photo",
      channel: CHANNEL,
      seoSettings: SEO_SETTINGS,
      publicBucketUrl: "https://cdn.example.com",
      canonicalUrl: "https://example.com/photo/sunset/",
    });
    expect(seo.image).toBe("https://cdn.example.com/production/images/sunset.png");
  });
});

describe("aggregatorSeo", () => {
  const publicBucketUrl = "https://cdn.example.com";

  test("gallery -> ImageGallery with member ImageObjects", () => {
    const item = {
      title: "My Gallery",
      content_html: "<p>A curated set</p>",
      slug: "my-gallery",
      content_type: "gallery",
    };
    const members = [
      {title: "Photo Alpha", image: "https://cdn.example.com/a.png", slug: "photo-alpha", content_type: "photo"},
      {title: "Photo Beta", image: "https://cdn.example.com/b.png", slug: "photo-beta", content_type: "photo"},
    ];
    const seo = aggregatorSeo({
      item,
      contentType: "gallery",
      members,
      channel: CHANNEL,
      seoSettings: SEO_SETTINGS,
      publicBucketUrl,
      canonicalUrl: "https://example.com/gallery/my-gallery/",
    });

    expect(seo.jsonLd["@type"]).toBe("ImageGallery");
    expect(seo.jsonLd.name).toBe("My Gallery");
    const memberField = seo.jsonLd.associatedMedia || seo.jsonLd.hasPart;
    expect(Array.isArray(memberField)).toBe(true);
    expect(memberField).toHaveLength(2);
    expect(memberField[0]).toMatchObject({"@type": "ImageObject", contentUrl: "https://cdn.example.com/a.png"});
  });

  test("landing_page -> CollectionPage with hasPart matched items", () => {
    const item = {
      title: "Blog Landing",
      content_html: "<p>Latest posts</p>",
      slug: "blog-landing",
      content_type: "landing_page",
    };
    const members = [
      {title: "Matching Article", slug: "matching-article", content_type: "blog_article"},
    ];
    const seo = aggregatorSeo({
      item,
      contentType: "landing_page",
      members,
      channel: CHANNEL,
      seoSettings: SEO_SETTINGS,
      publicBucketUrl,
      canonicalUrl: "https://example.com/blog-landing/",
    });

    expect(seo.jsonLd["@type"]).toBe("CollectionPage");
    expect(seo.jsonLd.hasPart).toHaveLength(1);
    expect(seo.jsonLd.hasPart[0]).toMatchObject({name: "Matching Article"});
  });
});

describe("listingSeo", () => {
  test("returns CollectionPage with an ItemList of listed items", () => {
    const items = [
      {title: "Article One", slug: "article-one", content_type: "blog_article"},
      {title: "Article Two", slug: "article-two", content_type: "blog_article"},
    ];
    const seo = listingSeo({
      typeLabel: "Blog",
      items,
      channel: CHANNEL,
      seoSettings: SEO_SETTINGS,
      canonicalUrl: "https://example.com/blog/",
    });

    expect(seo.jsonLd["@type"]).toBe("CollectionPage");
    expect(seo.jsonLd.mainEntity["@type"]).toBe("ItemList");
    expect(seo.jsonLd.mainEntity.itemListElement).toHaveLength(2);
    expect(seo.jsonLd.mainEntity.itemListElement[0]).toMatchObject({
      "@type": "ListItem",
      position: 1,
      name: "Article One",
    });
    expect(seo.title).toContain("Blog");
  });
});

describe("keywords merge", () => {
  test("keywords = item tags + settings keyTerms, deduped", () => {
    const item = {
      title: "Hello",
      content_html: "<p>Body</p>",
      tags: ["testing", "extra"],
      slug: "hello",
      content_type: "blog_article",
    };
    const seo = recordSeo({
      item,
      contentType: "blog_article",
      channel: CHANNEL,
      seoSettings: SEO_SETTINGS,
      publicBucketUrl: "https://cdn.example.com",
      canonicalUrl: "https://example.com/blog/hello/",
    });
    expect(seo.keywords).toEqual(expect.arrayContaining(["testing", "extra", "quality", "software"]));
    // "testing" appears both in tags and keyTerms - should be deduped.
    const testingCount = seo.keywords.filter((k) => k === "testing").length;
    expect(testingCount).toBe(1);
  });
});

describe("image URLs are always absolute (OG/Twitter/JSON-LD require it)", () => {
  const rootRelativeChannel = {title: "Site", description: "d", image: "/assets/default/channel-image.png"};

  test("siteSeo resolves a root-relative channel image against the page origin", () => {
    const seo = siteSeo({
      channel: rootRelativeChannel,
      seoSettings: {},
      publicBucketUrl: "",
      canonicalUrl: "https://site.test/",
    });
    expect(seo.image).toBe("https://site.test/assets/default/channel-image.png");
    expect(seo.jsonLd.image || seo.image).toMatch(/^https?:\/\//);
  });

  test("recordSeo resolves a root-relative item image against the page origin", () => {
    const seo = recordSeo({
      item: {title: "P", slug: "p", content_type: "blog_article", image: "/media-x/production/images/cover.jpg"},
      contentType: "blog_article",
      channel: rootRelativeChannel,
      seoSettings: {},
      publicBucketUrl: "",
      canonicalUrl: "https://site.test/blog/p/",
    });
    expect(seo.image).toBe("https://site.test/media-x/production/images/cover.jpg");
  });

  test("already-absolute image is left untouched", () => {
    const seo = recordSeo({
      item: {title: "P", slug: "p", content_type: "blog_article", image: "https://cdn.example.com/x.jpg"},
      contentType: "blog_article",
      channel: rootRelativeChannel,
      seoSettings: {},
      publicBucketUrl: "https://cdn.example.com",
      canonicalUrl: "https://site.test/blog/p/",
    });
    expect(seo.image).toBe("https://cdn.example.com/x.jpg");
  });
});
