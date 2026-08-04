import {describe, expect, it} from "vitest";

import {
  isPublicFeedOffline,
  shouldHidePublicWeb,
} from "@/server/feed/feed";
import type {AccessPolicy, FeedContent} from "@/types";

function contentWithPolicy(currentPolicy?: AccessPolicy): FeedContent {
  return currentPolicy
    ? {settings: {access: {currentPolicy}}}
    : {settings: {}};
}

describe("public access policies", () => {
  it.each([
    [undefined, false, false],
    ["public", false, false],
    ["headless", false, true],
    ["offline", true, true],
  ] as const)(
    "resolves %s feed and web visibility",
    (currentPolicy, feedOffline, webHidden) => {
      const content = contentWithPolicy(currentPolicy);

      expect(isPublicFeedOffline(content)).toBe(feedOffline);
      expect(shouldHidePublicWeb(content)).toBe(webHidden);
    },
  );
});
