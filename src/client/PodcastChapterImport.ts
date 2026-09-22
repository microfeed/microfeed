import * as z from "zod";
import {PODCAST_LIMITS, podcastChapterSchema, podcastChaptersSchema, type PodcastChapter} from "@/shared/Podcast";

export const CHAPTER_IMPORT_MAX_BYTES = 1024 * 1024;

export interface ChapterImport {
  chapters: PodcastChapter[];
  omittedMetadata: boolean;
}

const entriesSchema = z.array(podcastChapterSchema).min(1, "The file contains no chapters.")
  .max(PODCAST_LIMITS.chapters, `Import up to ${PODCAST_LIMITS.chapters} chapters at a time.`);

/** Read locally; only validated entries enter the existing item save path. */
export async function readPodcastChapterFile(file: File): Promise<ChapterImport> {
  if (!/\.json$/iu.test(file.name)) throw new Error("Choose a .json chapter file.");
  if (!file.size || file.size > CHAPTER_IMPORT_MAX_BYTES) throw new Error("Choose a nonempty JSON file no larger than 1 MB.");
  let input: unknown;
  try {
    input = JSON.parse((await file.text()).replace(/^\uFEFF/u, ""));
  } catch {
    throw new Error("The file could not be read as JSON. Check its contents and try again.");
  }
  let entries: unknown = input;
  let omittedMetadata = false;
  if (!Array.isArray(input)) {
    if (!input || typeof input !== "object" || !Array.isArray((input as Record<string, unknown>).chapters)) {
      throw new Error("Use a JSON object with a chapters array, or a chapter array.");
    }
    const document = input as Record<string, unknown>;
    if (document.version !== undefined && document.version !== "1.2.0") {
      throw new Error("Use chapter format version 1.2.0.");
    }
    entries = document.chapters;
    omittedMetadata = Object.keys(document).some((key) => key !== "version" && key !== "chapters");
  }
  const parsed = entriesSchema.safeParse(entries);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const prefix = typeof issue.path[0] === "number" ? `Chapter ${issue.path[0] + 1}: ` : "";
    if (issue.code === "unrecognized_keys") {
      throw new Error(`${prefix}Only startTime, title, img, and url are supported. Remove other chapter fields before importing.`);
    }
    const field = issue.path[1];
    throw new Error(`${prefix}${field ? `${String(field)} — ` : ""}${issue.message}`);
  }
  const chapters = parsed.data.sort((a, b) => a.startTime - b.startTime);
  const ordered = podcastChaptersSchema.safeParse(chapters);
  if (!ordered.success) throw new Error("Each chapter must have a different start time.");
  return {chapters, omittedMetadata};
}
