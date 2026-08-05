import {describe, expect, it} from "vitest";

import FeedPublicJsonBuilder from "@/server/feed/FeedPublicJsonBuilder";
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
