import {describe, expect, it} from "vitest";

import {getMediaResponse} from "@/server/media/media";
import {
  mediaBucket,
  mediaStorageUnavailableResponse,
} from "@/server/media/storage";

describe("optional media storage", () => {
  it("returns the degraded-mode contract when MEDIA_BUCKET is absent", async () => {
    const response = mediaStorageUnavailableResponse();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: "media_storage_unavailable",
      error:
        "Media storage is not configured. Enable R2 for this microfeed instance.",
    });
  });

  it("returns 503 from /media behavior instead of touching a missing binding", async () => {
    const runtimeEnv = {} as Env;
    expect(mediaBucket(runtimeEnv)).toBeNull();

    const response = await getMediaResponse(
      new Request("https://feed.example.com/media/images/test.png"),
      runtimeEnv,
      "images/test.png",
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "media_storage_unavailable",
    });
  });
});
