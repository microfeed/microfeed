import Requests from "./requests";
import {PODCAST_IMAGE_MAX_BYTES, TRANSCRIPT_MAX_BYTES} from "@/shared/Podcast";
import {urlJoinWithRelative} from "@/shared/StringUtils";

export async function preparePodcastUpload(file: File, kind: "transcript" | "image"): Promise<Blob> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const limit = kind === "transcript" ? TRANSCRIPT_MAX_BYTES : PODCAST_IMAGE_MAX_BYTES;
  if (!file.size || file.size > limit) throw new Error(`Choose a nonempty file smaller than ${limit / 1024 / 1024} MB.`);
  if (kind === "image") {
    if (!["jpg", "jpeg", "png"].includes(extension ?? "") || !["image/jpeg", "image/png"].includes(file.type)) {
      throw new Error("Choose a JPEG or PNG image.");
    }
    return file;
  }
  if (!["vtt", "srt"].includes(extension ?? "")) throw new Error("Choose a VTT or SRT transcript.");
  const text = (await file.text()).replace(/^\uFEFF/u, "");
  if (extension === "vtt" ? !/^WEBVTT(?:[ \t]|\r?\n)/u.test(text) || !text.includes("-->")
    : !/\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/u.test(text)) {
    throw new Error("This file does not look like a timed VTT or SRT transcript.");
  }
  return new Blob([text], {type: extension === "vtt" ? "text/vtt" : "application/x-subrip"});
}

export async function uploadPodcastFile(file: File, kind: "transcript" | "image", publicBucketUrl: string,
  onProgress: (value: number) => void): Promise<{url: string; type: string}> {
  const blob = await preparePodcastUpload(file, kind);
  const extension = kind === "transcript" ? (blob.type === "text/vtt" ? "vtt" : "srt") : blob.type === "image/png" ? "png" : "jpg";
  const key = `${kind === "transcript" ? "transcripts" : "images"}/podcast-${crypto.randomUUID()}.${extension}`;
  return new Promise((resolve, reject) => {
    const failure = () => reject(new Error("Upload failed. Your draft is still here; please try again."));
    Requests.upload(blob, key, onProgress, (url: string) => resolve({
      url: new URL(urlJoinWithRelative(publicBucketUrl, url, window.location.origin), window.location.origin).href, type: blob.type,
    }), failure, failure);
  });
}
