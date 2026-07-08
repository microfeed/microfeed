import {
  classifyImageFieldFile,
  getNormalizedSquareOutputSize,
  isImageFieldCompatibleStoredMedia,
} from "./imageFieldUploadPipeline";

describe("imageFieldUploadPipeline", () => {
  test("classifies a raster upload as AVIF-normalized output", () => {
    const file = {name: "cover.png", type: "image/png"};

    expect(classifyImageFieldFile(file)).toMatchObject({
      kind: "raster",
      outputExtension: "avif",
      outputContentType: "image/avif",
    });
  });

  test("classifies SVG and animated inputs as passthrough exceptions", () => {
    expect(classifyImageFieldFile({name: "logo.svg", type: "image/svg+xml"})).toMatchObject({
      kind: "svg",
      outputExtension: "svg",
      outputContentType: "image/svg+xml",
    });

    expect(classifyImageFieldFile({name: "anim.gif", type: "image/gif"})).toMatchObject({
      kind: "animated",
      outputExtension: "gif",
      outputContentType: "image/gif",
    });
  });

  test("caps the final square output at 1024 without upscaling smaller images", () => {
    expect(getNormalizedSquareOutputSize(1600, 1200)).toBe(1024);
    expect(getNormalizedSquareOutputSize(800, 600)).toBe(600);
    expect(getNormalizedSquareOutputSize(320, 320)).toBe(320);
  });

  test("only accepts already-compatible media-library assets for image fields", () => {
    expect(isImageFieldCompatibleStoredMedia({content_type: "image/avif", url: "a.avif"})).toBe(true);
    expect(isImageFieldCompatibleStoredMedia({content_type: "image/svg+xml", url: "b.svg"})).toBe(true);
    expect(isImageFieldCompatibleStoredMedia({content_type: "image/gif", url: "c.gif"})).toBe(true);
    expect(isImageFieldCompatibleStoredMedia({content_type: "image/png", url: "legacy.png"})).toBe(false);
  });
});
