import {describe, expect, it, vi} from "vitest";
import {encodeSocialCrop, SOCIAL_IMAGE_MAX_BYTES} from "@/client/SocialImageCrop";

function canvas(alpha: number, result?: Blob | null) {
  return {
    width: 1200, height: 630,
    getContext: () => ({getImageData: () => ({data: new Uint8ClampedArray([255, 120, 70, alpha])})}),
    toBlob: vi.fn((callback, type) => callback(result === undefined ? new Blob(["crop"], {type}) : result)),
  } as unknown as HTMLCanvasElement;
}

describe("social image encoding", () => {
  it("exports opaque photographs as JPEG and preserves transparency as PNG", async () => {
    expect((await encodeSocialCrop(canvas(255))).type).toBe("image/jpeg");
    expect((await encodeSocialCrop(canvas(254))).type).toBe("image/png");
  });
  it("rejects failed or oversized output before any upload", async () => {
    await expect(encodeSocialCrop(canvas(255, null))).rejects.toThrow("Could not prepare");
    await expect(encodeSocialCrop(canvas(255, new Blob([new Uint8Array(SOCIAL_IMAGE_MAX_BYTES)])))).rejects.toThrow("5 MB");
  });
});
