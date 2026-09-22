import {describe, expect, it} from "vitest";
import {CHAPTER_IMPORT_MAX_BYTES, readPodcastChapterFile} from "@/client/PodcastChapterImport";

const file = (value: unknown, name = "chapters.json") => new File([JSON.stringify(value)], name);

describe("chapter JSON import", () => {
  it("imports a versioned document, sorts times, and preserves titles, images, and links", async () => {
    const later = {startTime: 90.5, title: "Interview", img: "https://example.com/photo.png", url: "https://example.com/notes/"};
    const earlier = {startTime: 0, title: "Intro"};
    const result = await readPodcastChapterFile(file({version: "1.2.0", chapters: [later, earlier]}));
    expect(result).toEqual({chapters: [earlier, later], omittedMetadata: false});
  });
  it("accepts an array, UTF-8 BOM, and documents without a version, and reports excluded document metadata", async () => {
    const chapters = [{startTime: 0, title: "  Bonjour 世界  "}];
    expect((await readPodcastChapterFile(new File([`\uFEFF${JSON.stringify(chapters)}`], "CHAPTERS.JSON"))).chapters[0]?.title).toBe("Bonjour 世界");
    expect((await readPodcastChapterFile(file({chapters, author: "Author", title: "Episode"}))).omittedMetadata).toBe(true);
  });
  it("rejects malformed, unsupported, empty, oversized, and non-JSON files", async () => {
    for (const input of [null, "hello", 123, {}, {chapters: {}}, {version: "2.0.0", chapters: [{startTime: 0, title: "Intro"}]}, [], {chapters: []}]) {
      await expect(readPodcastChapterFile(file(input))).rejects.toThrow();
    }
    await expect(readPodcastChapterFile(new File(["{bad"], "chapters.json"))).rejects.toThrow("JSON");
    await expect(readPodcastChapterFile(new File([], "chapters.json"))).rejects.toThrow("nonempty");
    await expect(readPodcastChapterFile(file([], "chapters.txt"))).rejects.toThrow(".json");
    await expect(readPodcastChapterFile(new File([new Uint8Array(CHAPTER_IMPORT_MAX_BYTES + 1)], "chapters.json"))).rejects.toThrow("1 MB");
  });
  it("rejects duplicate times, unsafe links, missing titles, and unsupported fields without dropping data", async () => {
    const good = {startTime: 0, title: "Intro"};
    await expect(readPodcastChapterFile(file([good, good]))).rejects.toThrow("different start time");
    await expect(readPodcastChapterFile(file([good, {startTime: 1, title: "Next", url: "javascript:alert(1)"}]))).rejects.toThrow("Chapter 2: url");
    await expect(readPodcastChapterFile(file([{startTime: 0}]))).rejects.toThrow("Chapter 1: title");
    await expect(readPodcastChapterFile(file([{...good, toc: false}]))).rejects.toThrow("Only startTime, title, img, and url");
    await expect(readPodcastChapterFile(file([{...good, startTime: "01:30"}]))).rejects.toThrow("startTime");
  });
  it("enforces the existing entry limit before previewing", async () => {
    const chapters = Array.from({length: 100}, (_, startTime) => ({startTime, title: `Chapter ${startTime}`}));
    expect((await readPodcastChapterFile(file(chapters))).chapters).toHaveLength(100);
    await expect(readPodcastChapterFile(file([...chapters, {startTime: 101, title: "Too many"}]))).rejects.toThrow("100 chapters");
  });
});
