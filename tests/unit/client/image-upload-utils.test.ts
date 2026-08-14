import {describe, expect, it, vi} from "vitest";

import {
  convertImageToAvif,
  queueReplacedImageUrl,
} from "@/client/ImageUploadUtils";

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

  it("leaves an already-AVIF blob unchanged", async () => {
    const avif = new Blob(["avif"], {type: "image/avif"});
    await expect(convertImageToAvif(avif)).resolves.toBe(avif);
  });

  it("converts a non-AVIF image to AVIF", async () => {
    const png = new Blob(["png"], {type: "image/png"});
    const avif = new Blob(["avif"], {type: "image/avif"});
    const bitmap = {close: vi.fn(), height: 2, width: 2};
    const toBlob = vi.fn((callback: (blob: Blob | null) => void) => {
      callback(avif);
    });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => ({drawImage: vi.fn()}),
        height: 0,
        toBlob,
        width: 0,
      }),
    });

    await expect(convertImageToAvif(png)).resolves.toBe(avif);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/avif", 0.8);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it("falls back to the original blob when AVIF encoding is unsupported", async () => {
    const png = new Blob(["png"], {type: "image/png"});
    const bitmap = {close: vi.fn(), height: 2, width: 2};
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => ({drawImage: vi.fn()}),
        height: 0,
        toBlob: (callback: (blob: Blob | null) => void) => callback(png),
        width: 0,
      }),
    });

    await expect(convertImageToAvif(png)).resolves.toBe(png);
  });

  it("returns the original blob when decoding fails", async () => {
    const png = new Blob(["png"], {type: "image/png"});
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decode")));

    await expect(convertImageToAvif(png)).resolves.toBe(png);
  });
});
