import {serializeItemForFeed} from "./FeedItemSerializer";

const PUBLIC_BUCKET_URL = "https://cdn.example.com";

function makeRow({id, content_type, status, slug, pub_date, data}) {
  return {
    id,
    content_type,
    status,
    slug,
    pub_date,
    data: JSON.stringify(data),
  };
}

describe("serializeItemForFeed", () => {
  test("podcast_episode with audio attachment + image gets absolute urls, iTunes fields, status as string", () => {
    const row = makeRow({
      id: "ep-1",
      content_type: "podcast_episode",
      status: 1,
      slug: "episode-one",
      pub_date: "2024-07-04T00:00:00.000Z",
      data: {
        title: "Episode One",
        link: "https://example.com/ep1",
        description: "<p>Show notes</p>",
        image: "production/ep1.png",
        mediaFile: {
          category: "audio",
          url: "production/ep1.mp3",
          contentType: "audio/mpeg",
          sizeByte: 12345,
          durationSecond: 600,
        },
        guid: "guid-1",
        "itunes:title": "Ep One",
        "itunes:block": false,
        "itunes:episodeType": "full",
        "itunes:season": 1,
        "itunes:episode": 1,
        "itunes:explicit": false,
      },
    });

    const result = serializeItemForFeed(row, {publicBucketUrl: PUBLIC_BUCKET_URL});

    expect(result).toEqual({
      id: "ep-1",
      content_type: "podcast_episode",
      slug: "episode-one",
      status: "published",
      date_published_ms: new Date("2024-07-04T00:00:00.000Z").getTime(),
      title: "Episode One",
      url: "https://example.com/ep1",
      content_html: "<p>Show notes</p>",
      image: "https://cdn.example.com/production/ep1.png",
      attachment: {
        category: "audio",
        url: "https://cdn.example.com/production/ep1.mp3",
        mime_type: "audio/mpeg",
        size_in_bytes: 12345,
        duration_in_seconds: 600,
      },
      guid: "guid-1",
      _microfeed: {
        "itunes:title": "Ep One",
        "itunes:block": false,
        "itunes:episodeType": "full",
        "itunes:season": 1,
        "itunes:episode": 1,
        "itunes:explicit": false,
      },
    });
  });

  test("podcast_episode with external_url attachment leaves attachment url untouched", () => {
    const row = makeRow({
      id: "ep-2",
      content_type: "podcast_episode",
      status: 1,
      slug: "episode-two",
      pub_date: "2024-07-05T00:00:00.000Z",
      data: {
        title: "Episode Two",
        mediaFile: {
          category: "external_url",
          url: "https://external.example.com/ep2",
        },
      },
    });

    const result = serializeItemForFeed(row, {publicBucketUrl: PUBLIC_BUCKET_URL});

    expect(result.attachment).toEqual({
      category: "external_url",
      url: "https://external.example.com/ep2",
    });
    expect(result.image).toBeUndefined();
  });

  test("blog_article with tagIds surfaces tags, absolute cover image, content_html/excerpt/author", () => {
    const row = makeRow({
      id: "post-1",
      content_type: "blog_article",
      status: 1,
      slug: "hello-world",
      pub_date: "2024-07-04T00:00:00.000Z",
      data: {
        title: "Hello World",
        description: "<p>Body</p>",
        image: "production/cover.png",
        excerpt: "Short teaser",
        author: "Ada Lovelace",
      },
    });

    const result = serializeItemForFeed(row, {
      publicBucketUrl: PUBLIC_BUCKET_URL,
      tagIds: ["t1", "t2"],
    });

    expect(result).toEqual({
      id: "post-1",
      content_type: "blog_article",
      slug: "hello-world",
      status: "published",
      date_published_ms: new Date("2024-07-04T00:00:00.000Z").getTime(),
      title: "Hello World",
      content_html: "<p>Body</p>",
      image: "https://cdn.example.com/production/cover.png",
      excerpt: "Short teaser",
      author: "Ada Lovelace",
      tags: ["t1", "t2"],
    });
  });

  test("photo has caption + absolute image + date_published_ms from taken_date", () => {
    const row = makeRow({
      id: "photo-1",
      content_type: "photo",
      status: 1,
      slug: "sunset",
      pub_date: "2024-06-01T00:00:00.000Z",
      data: {
        title: "Sunset",
        image: "production/sunset.png",
        caption: "A beautiful sunset",
      },
    });

    const result = serializeItemForFeed(row, {publicBucketUrl: PUBLIC_BUCKET_URL});

    expect(result).toEqual({
      id: "photo-1",
      content_type: "photo",
      slug: "sunset",
      status: "published",
      date_published_ms: new Date("2024-06-01T00:00:00.000Z").getTime(),
      title: "Sunset",
      image: "https://cdn.example.com/production/sunset.png",
      caption: "A beautiful sunset",
      tags: [],
    });
  });

  test("gallery aggregator surfaces members as items in order", () => {
    const row = makeRow({
      id: "gallery-1",
      content_type: "gallery",
      status: 1,
      slug: "vacation",
      pub_date: "2024-06-01T00:00:00.000Z",
      data: {
        title: "Vacation",
        description: "<p>Trip photos</p>",
        image: "production/gallery-cover.png",
      },
    });

    const photoOne = {
      id: "photo-1",
      content_type: "photo",
      slug: "sunset",
      status: "published",
      date_published_ms: 1717200000000,
      title: "Sunset",
      image: "https://cdn.example.com/production/sunset.png",
      caption: "A beautiful sunset",
    };
    const photoTwo = {
      id: "photo-2",
      content_type: "photo",
      slug: "sunrise",
      status: "published",
      date_published_ms: 1717286400000,
      title: "Sunrise",
      image: "https://cdn.example.com/production/sunrise.png",
      caption: "A beautiful sunrise",
    };

    const result = serializeItemForFeed(row, {
      publicBucketUrl: PUBLIC_BUCKET_URL,
      members: [photoOne, photoTwo],
    });

    expect(result.items).toEqual([photoOne, photoTwo]);
    expect(result).toMatchObject({
      id: "gallery-1",
      content_type: "gallery",
      slug: "vacation",
      status: "published",
      title: "Vacation",
      content_html: "<p>Trip photos</p>",
      image: "https://cdn.example.com/production/gallery-cover.png",
    });
  });

  test("landing_page surfaces content_types/filter_tags/sort/limit/layout", () => {
    const row = makeRow({
      id: "landing-1",
      content_type: "landing_page",
      status: 1,
      slug: "latest",
      pub_date: "2024-06-01T00:00:00.000Z",
      data: {
        title: "Latest",
        description: "<p>Intro</p>",
        content_types: ["podcast_episode", "blog_article"],
        filter_tags: ["news"],
        sort: "newest_first",
        limit: 10,
        layout: "grid",
      },
    });

    const result = serializeItemForFeed(row, {publicBucketUrl: PUBLIC_BUCKET_URL});

    expect(result).toEqual({
      id: "landing-1",
      content_type: "landing_page",
      slug: "latest",
      status: "published",
      date_published_ms: new Date("2024-06-01T00:00:00.000Z").getTime(),
      title: "Latest",
      content_html: "<p>Intro</p>",
      content_types: ["podcast_episode", "blog_article"],
      filter_tags: ["news"],
      sort: "newest_first",
      limit: 10,
      layout: "grid",
      items: [],
    });
  });

  test("landing_page with data.showInNav=true serializes to item.showInNav === true", () => {
    const row = makeRow({
      id: "landing-2",
      content_type: "landing_page",
      status: 1,
      slug: "flagged",
      pub_date: "2024-06-01T00:00:00.000Z",
      data: {
        title: "Flagged",
        showInNav: true,
      },
    });

    const result = serializeItemForFeed(row, {publicBucketUrl: PUBLIC_BUCKET_URL});

    expect(result.showInNav).toBe(true);
  });

  test("blog_article surfaces seoTitle/seoDescription/noindex and absolute shareImage (PRD_SEO_GEO 3.2)", () => {
    const row = makeRow({
      id: "post-2",
      content_type: "blog_article",
      status: 1,
      slug: "seo-post",
      pub_date: "2024-07-04T00:00:00.000Z",
      data: {
        title: "SEO Post",
        description: "<p>Body</p>",
        seoTitle: "Custom SEO Title",
        seoDescription: "Custom SEO description",
        shareImage: "production/share.png",
        noindex: true,
      },
    });

    const result = serializeItemForFeed(row, {publicBucketUrl: PUBLIC_BUCKET_URL});

    expect(result.seoTitle).toBe("Custom SEO Title");
    expect(result.seoDescription).toBe("Custom SEO description");
    expect(result.shareImage).toBe("https://cdn.example.com/production/share.png");
    expect(result.noindex).toBe(true);
  });

  test("blog_article without SEO overrides omits seoTitle/seoDescription/shareImage/noindex", () => {
    const row = makeRow({
      id: "post-3",
      content_type: "blog_article",
      status: 1,
      slug: "plain-post",
      pub_date: "2024-07-04T00:00:00.000Z",
      data: {
        title: "Plain Post",
        description: "<p>Body</p>",
      },
    });

    const result = serializeItemForFeed(row, {publicBucketUrl: PUBLIC_BUCKET_URL});

    expect(result.seoTitle).toBeUndefined();
    expect(result.seoDescription).toBeUndefined();
    expect(result.shareImage).toBeUndefined();
    expect(result.noindex).toBeUndefined();
  });

  test("photo/podcast_episode/gallery/landing_page also round-trip noindex + share_image", () => {
    const photoRow = makeRow({
      id: "photo-2",
      content_type: "photo",
      status: 1,
      slug: "seo-photo",
      pub_date: "2024-06-01T00:00:00.000Z",
      data: {
        title: "Seo Photo",
        image: "production/photo.png",
        shareImage: "production/photo-share.png",
        noindex: false,
      },
    });
    expect(serializeItemForFeed(photoRow, {publicBucketUrl: PUBLIC_BUCKET_URL}).shareImage).toBe(
      "https://cdn.example.com/production/photo-share.png",
    );
    expect(serializeItemForFeed(photoRow, {publicBucketUrl: PUBLIC_BUCKET_URL}).noindex).toBe(false);

    const galleryRow = makeRow({
      id: "gallery-2",
      content_type: "gallery",
      status: 1,
      slug: "seo-gallery",
      pub_date: "2024-06-01T00:00:00.000Z",
      data: {
        title: "Seo Gallery",
        shareImage: "production/gallery-share.png",
      },
    });
    expect(serializeItemForFeed(galleryRow, {publicBucketUrl: PUBLIC_BUCKET_URL}).shareImage).toBe(
      "https://cdn.example.com/production/gallery-share.png",
    );

    const landingRow = makeRow({
      id: "landing-4",
      content_type: "landing_page",
      status: 1,
      slug: "seo-landing",
      pub_date: "2024-06-01T00:00:00.000Z",
      data: {
        title: "Seo Landing",
        seoDescription: "Landing description override",
      },
    });
    expect(serializeItemForFeed(landingRow, {publicBucketUrl: PUBLIC_BUCKET_URL}).seoDescription).toBe(
      "Landing description override",
    );

    const podcastRow = makeRow({
      id: "ep-3",
      content_type: "podcast_episode",
      status: 1,
      slug: "seo-episode",
      pub_date: "2024-07-04T00:00:00.000Z",
      data: {
        title: "Seo Episode",
        seoTitle: "Custom Episode SEO Title",
      },
    });
    expect(serializeItemForFeed(podcastRow, {publicBucketUrl: PUBLIC_BUCKET_URL}).seoTitle).toBe(
      "Custom Episode SEO Title",
    );
  });

  test("landing_page with showInNav absent from data leaves item.showInNav undefined", () => {
    const row = makeRow({
      id: "landing-3",
      content_type: "landing_page",
      status: 1,
      slug: "unflagged",
      pub_date: "2024-06-01T00:00:00.000Z",
      data: {
        title: "Unflagged",
      },
    });

    const result = serializeItemForFeed(row, {publicBucketUrl: PUBLIC_BUCKET_URL});

    expect(result.showInNav).toBeUndefined();
  });
});
