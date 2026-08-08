import {afterEach, describe, expect, it, vi} from "vitest";

import FeedPublicJsonBuilder from "@/server/feed/FeedPublicJsonBuilder";
import FeedPublicRssBuilder from "@/server/feed/FeedPublicRssBuilder";
import {LEGACY_DEFAULT_FAVICON_URL} from "@/shared/Favicon";

function buildChannel(faviconUrl: string) {
  const builder = new FeedPublicJsonBuilder(
    {
      channel: {
        image: "channel/image.png",
        title: "Example feed",
      },
      settings: {
        webGlobalSettings: {
          favicon: {
            contentType: "image/png",
            url: faviconUrl,
          },
          publicBucketUrl: "/media/",
        },
      },
    },
    "https://feed.example.com",
    new Request("https://feed.example.com/json/"),
  );

  return builder._buildPublicContentChannel();
}

describe("public JSON feed favicon", () => {
  it("falls back to the channel image before a favicon is uploaded", () => {
    expect(buildChannel(LEGACY_DEFAULT_FAVICON_URL)).toMatchObject({
      favicon: "/media/channel/image.png",
      icon: "/media/channel/image.png",
    });
  });

  it("uses a separately uploaded favicon", () => {
    expect(buildChannel("uploads/favicon.png")).toMatchObject({
      favicon: "/media/uploads/favicon.png",
      icon: "/media/channel/image.png",
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("public channel copyright", () => {
  it("resolves current_year in JSON and RSS output", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T00:00:00.000Z"));

    const json = new FeedPublicJsonBuilder(
      {
        channel: {
          copyright: "© {{ current_year }} Example Publisher",
          title: "Example feed",
        },
        items: [],
        settings: {},
      },
      "https://feed.example.com",
      new Request("https://feed.example.com/json/"),
    ).getJsonData() as any;

    expect(json._microfeed.copyright).toBe("© 2027 Example Publisher");
    const rss = new FeedPublicRssBuilder(
      json,
      "https://feed.example.com",
    ).getRssData();
    expect(rss).toContain(
      "<copyright>© 2027 Example Publisher</copyright>",
    );

    const directRss = new FeedPublicRssBuilder({
      _microfeed: {copyright: "©{{ current_year }}"},
      items: [],
      title: "Example feed",
    }, "https://feed.example.com").getRssData();
    expect(directRss).toContain("<copyright>©2027</copyright>");
  });

  it("keeps static and unsupported copyright expressions unchanged", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T00:00:00.000Z"));

    const copyright = "© 2024 / {{unknown}} / {{_microfeed.base_url}}";
    const json = new FeedPublicJsonBuilder(
      {
        channel: {copyright, title: "Example feed"},
        items: [],
        settings: {},
      },
      "https://feed.example.com",
      new Request("https://feed.example.com/json/"),
    ).getJsonData() as any;

    expect(json._microfeed.copyright).toBe(copyright);
  });
});
