import {beforeEach, describe, expect, it, vi} from "vitest";

import encode from "@jsquash/avif/encode";
import {
  convertImageToAvif,
  queueReplacedImageUrl,
} from "@/client/ImageUploadUtils";

vi.mock("@jsquash/avif/encode", () => ({
  default: vi.fn(),
}));

describe("image upload utilities", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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
    const bitmap = {close: vi.fn(), height: 2, width: 2};
    const mockImageData = {data: new Uint8ClampedArray(16), height: 2, width: 2};
    const avifBuffer = new ArrayBuffer(8);

    vi.mocked(encode).mockResolvedValue(avifBuffer);
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => ({
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue(mockImageData),
        }),
        height: 0,
        width: 0,
      }),
    });

    const result = await convertImageToAvif(png);
    expect(result.type).toBe("image/avif");
    expect(await result.arrayBuffer()).toEqual(avifBuffer);
    expect(encode).toHaveBeenCalledWith(mockImageData, {quality: 80});
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it("falls back to the original blob when AVIF encoding fails", async () => {
    const png = new Blob(["png"], {type: "image/png"});
    const bitmap = {close: vi.fn(), height: 2, width: 2};
    vi.mocked(encode).mockRejectedValue(new Error("encoding error"));
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => ({
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({}),
        }),
        height: 0,
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
