import {normalizeObjectKey} from "@/server/media/uploads";
import type {
  DeleteImageRequest,
  ImageMetadataTarget,
} from "@/types";

const MANAGED_MEDIA_PREFIXES = new Set([
  "development",
  "preview",
  "production",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseImageMetadataTarget(
  value: unknown,
): ImageMetadataTarget | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }
  if (value.type === "favicon") {
    return {type: "favicon"};
  }
  if (value.type === "channel") {
    return typeof value.id === "string" && value.id.trim()
      ? {id: value.id.trim(), type: "channel"}
      : {type: "channel"};
  }
  if (
    value.type === "item" &&
    typeof value.id === "string" &&
    value.id.trim()
  ) {
    return {id: value.id.trim(), type: value.type};
  }
  return null;
}

export function parseDeleteImageRequest(
  value: unknown,
): DeleteImageRequest | null {
  if (
    !isRecord(value) ||
    typeof value.imageUrl !== "string" ||
    !value.imageUrl.trim()
  ) {
    return null;
  }
  if (value.target === undefined) {
    return {imageUrl: value.imageUrl.trim()};
  }
  const target = parseImageMetadataTarget(value.target);
  return target
    ? {imageUrl: value.imageUrl.trim(), target}
    : null;
}

export function managedMediaObjectKey(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  let path = value.trim();
  if (/^[a-z][a-z\d+.-]*:\/\//iu.test(path)) {
    return null;
  }
  path = path.replace(/^\/+media\//u, "");
  const key = normalizeObjectKey(path);
  const prefix = key?.split("/", 1)[0];
  if (!key || !prefix || !MANAGED_MEDIA_PREFIXES.has(prefix)) {
    return null;
  }
  return key;
}

export function scheduleBestEffortMediaDeletion(
  bucket: Pick<R2Bucket, "delete"> | null,
  imageUrls: unknown[],
  schedule: (promise: Promise<unknown>) => void,
  database?: D1Database,
): string[] {
  if (!bucket) {
    return [];
  }
  const keys = [...new Set(
    imageUrls
      .map((imageUrl) => managedMediaObjectKey(imageUrl))
      .filter((key): key is string => Boolean(key)),
  )];
  if (keys.length === 0) {
    return [];
  }

  schedule(
    (async () => {
      const unused: string[] = [];
      for (const key of keys) {
        // Conservative matching also retains references in bodies and settings.
        // False positives cost storage; a false negative could break published media.
        const referenced = database ? await database.prepare(
          "SELECT 1 WHERE EXISTS(SELECT 1 FROM channels WHERE instr(data, ?1) > 0) OR " +
          "EXISTS(SELECT 1 FROM items WHERE instr(data, ?1) > 0) OR " +
          "EXISTS(SELECT 1 FROM settings WHERE instr(data, ?1) > 0) OR " +
          "EXISTS(SELECT 1 FROM pages WHERE instr(content_html, ?1) > 0) OR " +
          "EXISTS(SELECT 1 FROM site_files WHERE instr(draft_content, ?1) > 0 OR instr(published_content, ?1) > 0) OR " +
          "EXISTS(SELECT 1 FROM themes WHERE instr(bundle_json, ?1) > 0) OR " +
          "EXISTS(SELECT 1 FROM theme_drafts WHERE instr(bundle_json, ?1) > 0)",
        ).bind(key).first() : null;
        if (!referenced) unused.push(key);
      }
      if (unused.length) await bucket.delete(unused);
    })().catch((error: unknown) => {
      console.error(JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        keyCount: keys.length,
        message: "Best-effort R2 image deletion failed",
      }));
    }),
  );
  return keys;
}
