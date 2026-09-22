import * as z from "zod";
import {ContentCustomizationError, languageOverrideSchema} from "./Seo";

export const PODCAST_LIMITS = {people: 50, funding: 10, transcripts: 10, chapters: 100, bytes: 65536} as const;
export const TRANSCRIPT_MAX_BYTES = 10 * 1024 * 1024;
export const PODCAST_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const CHAPTERS_CONTENT_TYPE = "application/json+chapters";

// Podcast namespace resources require HTTPS. Local development may use HTTP.
export const podcastUrlSchema = z.url().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return !url.username && !url.password && (url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  } catch { return false; }
}, "Use an HTTPS URL (HTTP is allowed for localhost development).");

export const PODCAST_ROLES = [
  {value: "host", label: "Host", group: "cast"},
  {value: "co-host", label: "Co-host", group: "cast"},
  {value: "guest", label: "Guest", group: "cast"},
  {value: "guest host", label: "Guest host", group: "cast"},
  {value: "narrator", label: "Narrator", group: "cast"},
  {value: "producer", label: "Producer", group: "creative direction"},
  {value: "author", label: "Author", group: "writing"},
] as const;

export const PODCAST_LICENSES = [
  {value: "arr", label: "All rights reserved"},
  {value: "cc-by-4.0", label: "Creative Commons Attribution 4.0"},
  {value: "cc-by-sa-4.0", label: "Creative Commons Attribution–ShareAlike 4.0"},
  {value: "cc-by-nd-4.0", label: "Creative Commons Attribution–NoDerivatives 4.0"},
  {value: "cc-by-nc-4.0", label: "Creative Commons Attribution–NonCommercial 4.0"},
  {value: "cc-by-nc-sa-4.0", label: "Creative Commons Attribution–NonCommercial–ShareAlike 4.0"},
  {value: "cc-by-nc-nd-4.0", label: "Creative Commons Attribution–NonCommercial–NoDerivatives 4.0"},
] as const;

export const podcastPersonSchema = z.object({
  name: z.string().trim().min(1).max(128),
  role: z.string().trim().min(1).max(64).optional(),
  group: z.string().trim().min(1).max(64).optional(),
  href: podcastUrlSchema.optional(),
  img: podcastUrlSchema.optional(),
}).strict();
export const podcastFundingSchema = z.object({
  label: z.string().trim().min(1).max(128),
  url: podcastUrlSchema,
}).strict();
export const podcastLicenseSchema = z.object({
  identifier: z.string().trim().min(1).max(128),
  url: podcastUrlSchema.optional(),
}).strict().refine((license) => license.url || PODCAST_LICENSES.some(({value}) => value === license.identifier.toLowerCase()), {
  message: "Provide the full license URL for a custom license.", path: ["url"],
});
export const podcastTranscriptSchema = z.object({
  url: podcastUrlSchema,
  type: z.enum(["text/vtt", "application/x-subrip"]),
  language: languageOverrideSchema.refine((language) => language.length > 0).optional(),
}).strict();
export const podcastChapterSchema = z.object({
  startTime: z.number({error: "Enter a valid start time, such as 00:01:30 or 90 seconds."})
    .nonnegative({error: "Start time cannot be negative."}).max(604800, {error: "Start time cannot exceed seven days."}),
  title: z.string().trim().min(1).max(128),
  img: podcastUrlSchema.optional(),
  url: podcastUrlSchema.optional(),
}).strict();
export const podcastChaptersSchema = z.array(podcastChapterSchema).max(PODCAST_LIMITS.chapters).superRefine((chapters, context) => {
  chapters.forEach((chapter, index) => {
    if (index && chapter.startTime <= chapters[index - 1]!.startTime) {
      context.addIssue({code: "custom", path: [index, "startTime"], message: "Chapter start times must be unique and in ascending order."});
    }
  });
});
const common = {
  people: z.array(podcastPersonSchema).max(PODCAST_LIMITS.people).nullable().optional(),
  license: podcastLicenseSchema.nullable().optional(),
};
const fits = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length <= PODCAST_LIMITS.bytes;
const sizeMessage = "Podcast fields must fit within 64 KiB. Shorten long links or reduce the number of entries.";
export const channelPodcastSchema = z.object({
  ...common,
  funding: z.array(podcastFundingSchema).max(PODCAST_LIMITS.funding).nullable().optional(),
  locked: z.boolean().nullable().optional(),
}).strict().refine(fits, sizeMessage);
export const itemPodcastSchema = z.object({
  ...common,
  transcripts: z.array(podcastTranscriptSchema).max(PODCAST_LIMITS.transcripts).nullable().optional(),
  chapters: podcastChaptersSchema.nullable().optional(),
}).strict().refine(fits, sizeMessage);
export const podcastChapterDocumentSchema = z.object({
  version: z.literal("1.2.0"),
  chapters: podcastChaptersSchema,
});
export type PodcastPerson = z.infer<typeof podcastPersonSchema>;
export type PodcastChapter = z.infer<typeof podcastChapterSchema>;
export type PodcastTranscript = z.infer<typeof podcastTranscriptSchema>;
export type PodcastLicense = z.infer<typeof podcastLicenseSchema>;
export type ChannelPodcast = z.infer<typeof channelPodcastSchema>;
export type ItemPodcast = z.infer<typeof itemPodcastSchema>;
export type Podcast = ChannelPodcast & ItemPodcast;

export function validatePodcast(value: Record<string, unknown>, isItem: boolean) {
  if (value.podcast == null) return;
  const result = (isItem ? itemPodcastSchema : channelPodcastSchema).safeParse(value.podcast);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    throw new ContentCustomizationError(`podcast.${issue.path.join(".")}: ${issue.message}`);
  }
  value.podcast = result.data;
}

export function podcastChaptersUrl(itemId: string, origin: string): string {
  return new URL(podcastChaptersPath(itemId), origin).href;
}

export function podcastChaptersPath(itemId: string): string {
  return `/i/${encodeURIComponent(itemId)}/chapters.json`;
}

export function chapterDocument(chapters: PodcastChapter[]) {
  return {version: "1.2.0" as const, chapters};
}

export function parseChapterTime(value: string): number {
  const text = value.trim();
  if (/^\d+(?:\.\d+)?$/u.test(text)) return Number(text);
  if (!/^\d+:[0-5]\d(?::[0-5]\d)?(?:\.\d+)?$/u.test(text)) return NaN;
  return text.split(":").reduce((seconds, part) => seconds * 60 + Number(part), 0);
}

export function formatChapterTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const fraction = seconds.toLocaleString("en-US", {useGrouping: false, maximumFractionDigits: 20}).split(".")[1];
  const rest = (Math.floor(seconds) % 60).toString().padStart(2, "0") + (fraction ? `.${fraction}` : "");
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${rest}`;
}
