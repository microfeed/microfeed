import {categorizeMedia} from "./MediaFileUtils";

describe("categorizeMedia", () => {
  test("categorizes by content type first", () => {
    expect(categorizeMedia("whatever", "image/png")).toBe("image");
    expect(categorizeMedia("whatever", "audio/mpeg")).toBe("audio");
    expect(categorizeMedia("whatever", "video/mp4")).toBe("video");
  });

  test("categorizes by file extension when no content type", () => {
    expect(categorizeMedia("proj/prod/images/a.png")).toBe("image");
    expect(categorizeMedia("proj/prod/images/a.webp")).toBe("image");
    expect(categorizeMedia("proj/prod/media/song.mp3")).toBe("audio");
    expect(categorizeMedia("proj/prod/media/clip.mp4")).toBe("video");
    expect(categorizeMedia("proj/prod/media/doc.pdf")).toBe("document");
  });

  test("falls back to 'other' for unknown or extensionless files", () => {
    expect(categorizeMedia("proj/prod/media/data.bin")).toBe("other");
    expect(categorizeMedia("proj/prod/media/noext")).toBe("other");
    expect(categorizeMedia("")).toBe("other");
  });
});
