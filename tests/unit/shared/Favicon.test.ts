import {describe, expect, it} from "vitest";

import {
  hasUploadedFavicon,
  LEGACY_DEFAULT_FAVICON_URL,
  resolveEffectiveFavicon,
} from "@/shared/Favicon";

describe("favicon resolution", () => {
  it("uses the channel image when no favicon has been uploaded", () => {
    expect(resolveEffectiveFavicon(undefined, "channel/image.png")).toEqual({
      url: "channel/image.png",
    });
    expect(hasUploadedFavicon(undefined)).toBe(false);
  });

  it("treats the legacy seeded asset as the pre-upload state", () => {
    const favicon = {
      contentType: "image/png",
      url: LEGACY_DEFAULT_FAVICON_URL,
    };

    expect(resolveEffectiveFavicon(favicon, "channel/image.png")).toEqual({
      url: "channel/image.png",
    });
    expect(hasUploadedFavicon(favicon)).toBe(false);
  });

  it("prefers an uploaded favicon over the channel image", () => {
    const favicon = {
      contentType: "image/webp",
      url: "uploads/favicon.webp",
    };

    expect(resolveEffectiveFavicon(favicon, "channel/image.png")).toEqual(
      favicon,
    );
    expect(hasUploadedFavicon(favicon)).toBe(true);
  });

  it("keeps the legacy default as a last resort without a channel image", () => {
    const favicon = {
      contentType: "image/png",
      url: LEGACY_DEFAULT_FAVICON_URL,
    };

    expect(resolveEffectiveFavicon(favicon, undefined)).toEqual(favicon);
  });
});
