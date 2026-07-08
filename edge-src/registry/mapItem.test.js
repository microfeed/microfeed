import {STATUSES} from "../../common-src/Constants";
import {mapItem, validateItem} from "./itemMapper";

describe("mapItem and validateItem", () => {
  test("maps podcast payload to the legacy internal shape", () => {
    const payload = {
      status: "unpublished",
      title: "title",
      url: "https://www.example.com/episode-link",
      content_html: "<p>show notes</p>",
      image: "https://www.image.com/abc/image.jpg",
      attachment: {
        category: "audio",
        url: "https://www.audio.com/bbc/audio.mp3",
      },
      date_published_ms: 324444,
      _microfeed: {
        "itunes:block": true,
        "itunes:episodeType": "bonus",
        "itunes:explicit": false,
      },
    };

    expect(validateItem("podcast_episode", payload)).toEqual({errors: []});
    expect(mapItem("podcast_episode", payload)).toEqual({
      status: STATUSES.UNPUBLISHED,
      title: "title",
      // url maps to the legacy internal key `link`
      link: "https://www.example.com/episode-link",
      // content_html maps to the legacy internal key `description`
      description: "<p>show notes</p>",
      image: "abc/image.jpg",
      mediaFile: {
        category: "audio",
        url: "bbc/audio.mp3",
      },
      pubDateMs: 324444,
      "itunes:block": true,
      "itunes:episodeType": "bonus",
      "itunes:explicit": false,
    });
  });

  test("maps blog payload including author and excerpt", () => {
    expect(mapItem("blog_article", {
      status: "published",
      title: "blog title",
      content_html: "<p>body</p>",
      excerpt: "a short teaser",
      author: "Ada Lovelace",
      tags: ["tag_1", "tag_2"],
      date_published_ms: 10,
    })).toEqual({
      status: STATUSES.PUBLISHED,
      title: "blog title",
      description: "<p>body</p>",
      excerpt: "a short teaser",
      author: "Ada Lovelace",
      tags: ["tag_1", "tag_2"],
      pubDateMs: 10,
    });
  });

  test("maps photo payload with caption and taken_date", () => {
    expect(mapItem("photo", {
      status: "published",
      title: "photo title",
      image: "https://cdn.example.com/photo.png",
      caption: "on the trail",
      tags: ["tag_1"],
      taken_date: 11,
    })).toEqual({
      status: STATUSES.PUBLISHED,
      title: "photo title",
      image: "photo.png",
      caption: "on the trail",
      tags: ["tag_1"],
      pubDateMs: 11,
    });
  });

  test("returns field-level errors for invalid payloads", () => {
    const result = validateItem("landing_page", {
      status: "archived",
      title: "landing",
      content_types: ["photo", "gallery"],
      limit: "nope",
    });

    expect(result.errors).toHaveLength(3);
    expect(result.errors).toEqual([
      expect.objectContaining({field: "status"}),
      expect.objectContaining({field: "content_types"}),
      expect.objectContaining({field: "limit"}),
    ]);
    expect(result.errors[0].message).toMatch(/one of/i);
    expect(result.errors[1].message).toMatch(/one of/i);
    expect(result.errors[2].message).toMatch(/number/i);
  });

  test("throws for unknown content types", () => {
    expect(() => mapItem("unknown", {})).toThrow(/unknown content type/i);
    expect(() => validateItem("unknown", {})).toThrow(/unknown content type/i);
  });
});
