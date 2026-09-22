import {afterEach, describe, expect, it, vi} from "vitest";
import {preparePodcastUpload, uploadPodcastFile} from "@/client/PodcastUploads";
import Requests from "@/client/requests";

vi.mock("@/client/requests", () => ({default: {upload: vi.fn()}}));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
const vtt = "WEBVTT\n\n00:00.000 --> 00:03.000\nHello";
const srt = "1\n00:00:00,000 --> 00:00:03,000\nHello";

describe("podcast uploads", () => {
  it("validates timed transcripts and supplies the correct content type", async () => {
    for (const [filename, content, type] of [["a.vtt", vtt, "text/vtt"], ["A.SRT", srt, "application/x-subrip"]]) {
      const blob = await preparePodcastUpload(new File([`\uFEFF${content}`], filename!, {type: "text/plain"}), "transcript");
      expect(blob.type).toBe(type);
      expect(await blob.text()).toBe(content);
    }
    for (const file of [new File([], "a.vtt"), new File(["not timed"], "a.vtt"), new File([vtt], "a.html"), new File([vtt], "a.srt")]) {
      await expect(preparePodcastUpload(file, "transcript")).rejects.toThrow();
    }
    await expect(preparePodcastUpload(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "a.vtt"), "transcript")).rejects.toThrow("10 MB");
  });
  it("allows only bounded JPEG/PNG image uploads", async () => {
    const image = new File(["image fixture"], "photo.jpg", {type: "image/jpeg"});
    expect(await preparePodcastUpload(image, "image")).toBe(image);
    await expect(preparePodcastUpload(new File(["svg"], "photo.svg", {type: "image/svg+xml"}), "image")).rejects.toThrow("JPEG or PNG");
    await expect(preparePodcastUpload(new File([new Uint8Array(8 * 1024 * 1024 + 1)], "photo.png", {type: "image/png"}), "image")).rejects.toThrow("8 MB");
  });
  it("uses the existing uploader with a unique key, a permanent URL, and progress", async () => {
    vi.stubGlobal("window", {location: {origin: "http://localhost:4321"}});
    const progress = vi.fn();
    vi.mocked(Requests.upload).mockImplementation((blob: any, key: any, onProgress: any, success: any) => {
      expect(blob.type).toBe("text/vtt");
      expect(key).toMatch(/^transcripts\/podcast-[\da-f-]+\.vtt$/);
      onProgress(0.5);
      success(`production/${key}`);
    });
    const uploaded = await uploadPodcastFile(new File([vtt], "a.vtt"), "transcript", "/media/", progress);
    expect(uploaded.type).toBe("text/vtt");
    expect(uploaded.url).toMatch(/^http:\/\/localhost:4321\/media\/production\/transcripts\//);
    expect(progress).toHaveBeenCalledWith(0.5);
  });
  it("surfaces upload failures without returning a broken URL", async () => {
    vi.mocked(Requests.upload).mockImplementation((_blob: any, _key: any, _progress: any, _success: any, failure: any) => failure());
    await expect(uploadPodcastFile(new File([srt], "a.srt"), "transcript", "https://media.example", vi.fn())).rejects.toThrow("Upload failed");
  });
});
