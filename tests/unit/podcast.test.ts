import {describe, expect, it} from "vitest";
import XMLBuilder from "fast-xml-builder";
import {
  channelPodcastSchema, itemPodcastSchema, podcastChapterDocumentSchema, podcastChaptersSchema,
  podcastLicenseSchema, podcastTranscriptSchema, podcastUrlSchema, parseChapterTime, formatChapterTime,
  validatePodcast, chapterDocument, podcastChaptersUrl,
} from "@/shared/Podcast";
import {podcastRssNodes} from "@/server/feed/podcast";
import {apiItemInputSchema, apiChannelInputSchema} from "@/shared/ApiSchemas";
import {OPENAPI_DOCUMENT} from "@/shared/OpenApiDocument";

describe("podcast metadata contracts", () => {
  it("accepts scoped fields, clearing, and language variants", () => {
    expect(channelPodcastSchema.parse({people: null, funding: [], locked: false, license: null})).toEqual({people: null, funding: [], locked: false, license: null});
    expect(itemPodcastSchema.parse({transcripts: [{url: "https://example.com/a.vtt", type: "text/vtt", language: "zh-Hans"}], chapters: []})).toHaveProperty("transcripts");
    expect(channelPodcastSchema.safeParse({transcripts: []}).success).toBe(false);
    expect(itemPodcastSchema.safeParse({locked: true}).success).toBe(false);
    expect(podcastTranscriptSchema.safeParse({url: "https://example.com/a", type: "text/html"}).success).toBe(false);
    expect(podcastTranscriptSchema.safeParse({url: "https://example.com/a", type: "text/vtt", language: "not a language"}).success).toBe(false);
    expect(podcastLicenseSchema.safeParse({identifier: "custom"}).success).toBe(false);
    expect(podcastLicenseSchema.safeParse({identifier: "CC-BY-4.0"}).success).toBe(true);
    expect(podcastLicenseSchema.safeParse({identifier: "custom", url: "https://example.com/license"}).success).toBe(true);
  });

  it("rejects unsafe URLs and bounds stored metadata", () => {
    for (const url of ["javascript:alert(1)", "data:text/plain,x", "http://example.com/a", "https://user:pass@example.com/", "not a URL"]) {
      expect(podcastUrlSchema.safeParse(url).success, url).toBe(false);
    }
    for (const url of ["https://example.com/a", "http://localhost:4321/media/a.vtt", "http://[::1]/a"]) {
      expect(podcastUrlSchema.safeParse(url).success, url).toBe(true);
    }
    expect(itemPodcastSchema.safeParse({chapters: Array.from({length: 101}, (_, startTime) => ({startTime, title: "Chapter"}))}).success).toBe(false);
    expect(channelPodcastSchema.safeParse({people: Array.from({length: 50}, () => ({name: "Host", href: `https://example.com/${"x".repeat(1900)}`}))}).success).toBe(false);
    expect(() => validatePodcast({podcast: {people: [{name: ""}]}}, false)).toThrow("podcast.people.0.name");
  });

  it("round trips fractional chapter times and enforces a unique time order", () => {
    for (const seconds of [0, 0.5, 90.1, 3600, 86399.99, 0.000001, 604800]) {
      expect(parseChapterTime(formatChapterTime(seconds))).toBeCloseTo(seconds, 9);
    }
    expect(parseChapterTime("1:30.25")).toBe(90.25);
    expect(parseChapterTime("01:20:30")).toBe(4830);
    for (const value of ["-1", "1:60", "00:99:00", "abc", ""]) expect(parseChapterTime(value)).toBeNaN();
    const chapters = [{startTime: 0, title: "Start"}, {startTime: 10.5, title: "Next", img: "https://example.com/a.png", url: "https://example.com/next"}];
    expect(podcastChapterDocumentSchema.parse(chapterDocument(chapters))).toEqual({version: "1.2.0", chapters});
    expect(podcastChaptersSchema.safeParse([...chapters].reverse()).success).toBe(false);
    expect(podcastChaptersSchema.safeParse([chapters[0], chapters[0]]).success).toBe(false);
    expect(podcastChaptersUrl("stable-id", "https://example.com")).toBe("https://example.com/i/stable-id/chapters.json");
  });

  it("publishes the new input and chapter response contracts", () => {
    expect(apiItemInputSchema.safeParse({_microfeed: {podcast: {transcripts: [], chapters: null}}}).success).toBe(true);
    expect(apiChannelInputSchema.safeParse({_microfeed: {podcast: {locked: true}}}).success).toBe(true);
    const operation = OPENAPI_DOCUMENT.paths?.["/i/{slug}/chapters.json"];
    expect(operation?.get?.security).toEqual([]);
    expect(operation?.get?.responses?.["200"]).toHaveProperty("content.application/json+chapters");
    expect(operation?.head?.responses).toHaveProperty("404");
  });
});

describe("podcast namespace serialization", () => {
  const xml = (nodes: Record<string, unknown>) => new XMLBuilder({ignoreAttributes: false}).build(nodes);
  it("escapes text and attributes and emits repeatable channel credits and funding", () => {
    const nodes = podcastRssNodes({people: [{name: "Host & <guest>", role: "host", href: 'https://example.com/?a=1&b="2"'}, {name: "Producer", role: "producer"}],
      funding: [{label: "Support & subscribe", url: "https://example.com/support"}], license: {identifier: "cc-by-4.0"}, locked: false});
    const output = xml(nodes);
    expect(output).toContain("Host &amp; &lt;guest&gt;");
    expect(output).toContain("&amp;b=&quot;2&quot;");
    expect(output.match(/<podcast:person /g)).toHaveLength(2);
    expect(output).toContain('<podcast:funding url="https://example.com/support">Support &amp; subscribe</podcast:funding>');
    expect(output).toContain("<podcast:locked>no</podcast:locked>");
    expect(output).toContain("<podcast:license>cc-by-4.0</podcast:license>");
  });
  it("emits item resources only where present and lets absent item credits inherit", () => {
    const nodes = podcastRssNodes({transcripts: [{url: "https://example.com/a.vtt", type: "text/vtt", language: "en"}, {url: "https://example.com/a.srt", type: "application/x-subrip"}],
      chapters: [{startTime: 0, title: "Start"}]}, "episode", "https://example.com");
    const output = xml(nodes);
    expect(output.match(/<podcast:transcript /g)).toHaveLength(2);
    expect(output).toContain('url="https://example.com/i/episode/chapters.json" type="application/json+chapters"');
    expect(output).not.toContain("podcast:person");
    expect(podcastRssNodes({people: [], license: null, locked: null})).toEqual({});
    expect(podcastRssNodes(null)).toEqual({});
  });
});
