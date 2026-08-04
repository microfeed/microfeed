import {describe, expect, it, vi} from "vitest";

import {
  managedMediaObjectKey,
  parseDeleteImageRequest,
  scheduleBestEffortMediaDeletion,
} from "@/server/media/deletions";

describe("managed image deletion", () => {
  it("accepts only supported metadata targets", () => {
    expect(parseDeleteImageRequest({
      imageUrl: "production/images/item.png",
      target: {id: "item-1", type: "item"},
    })).toEqual({
      imageUrl: "production/images/item.png",
      target: {id: "item-1", type: "item"},
    });
    expect(parseDeleteImageRequest({
      imageUrl: "production/images/favicon.png",
      target: {type: "favicon"},
    })).toEqual({
      imageUrl: "production/images/favicon.png",
      target: {type: "favicon"},
    });
    expect(parseDeleteImageRequest({
      imageUrl: "/assets/default/channel-image.png",
      target: {type: "channel"},
    })).toEqual({
      imageUrl: "/assets/default/channel-image.png",
      target: {type: "channel"},
    });
    expect(parseDeleteImageRequest({
      imageUrl: "production/images/item.png",
      target: {type: "item"},
    })).toBeNull();
    expect(parseDeleteImageRequest({imageUrl: ""})).toBeNull();
  });

  it("resolves only project-managed R2 object URLs", () => {
    expect(managedMediaObjectKey("production/images/channel.png")).toBe(
      "production/images/channel.png",
    );
    expect(managedMediaObjectKey(
      "https://media.example.com/preview/images/item.png",
    )).toBeNull();
    expect(managedMediaObjectKey(
      "/media/development/images/favicon.png",
    )).toBe("development/images/favicon.png");
    expect(managedMediaObjectKey("/assets/default/favicon.png")).toBeNull();
    expect(managedMediaObjectKey("images/unscoped.png")).toBeNull();
  });

  it("deduplicates keys and schedules deletion without awaiting it", async () => {
    const deleteObject = vi.fn().mockResolvedValue(undefined);
    const scheduled: Promise<unknown>[] = [];
    const keys = scheduleBestEffortMediaDeletion(
      {delete: deleteObject},
      [
        "production/images/item.png",
        "/media/production/images/item.png",
        "/assets/default/channel-image.png",
      ],
      (promise) => scheduled.push(promise),
    );

    expect(keys).toEqual(["production/images/item.png"]);
    expect(deleteObject).toHaveBeenCalledWith(["production/images/item.png"]);
    expect(scheduled).toHaveLength(1);
    await Promise.all(scheduled);
  });
});
