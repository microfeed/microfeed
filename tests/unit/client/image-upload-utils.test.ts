import {describe, expect, it} from "vitest";

import {queueReplacedImageUrl} from "@/client/ImageUploadUtils";

describe("image upload utilities", () => {
  it("queues each replaced image once", () => {
    const original = ["production/images/original.png"];

    expect(queueReplacedImageUrl(original, " production/images/second.png "))
      .toEqual([
        "production/images/original.png",
        "production/images/second.png",
      ]);
    expect(queueReplacedImageUrl(original, original[0])).toBe(original);
    expect(queueReplacedImageUrl(original, undefined)).toBe(original);
  });
});
