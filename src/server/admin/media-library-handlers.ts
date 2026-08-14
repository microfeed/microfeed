import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "@/server/http";
import {
  deleteMediaLibraryEntry,
  getMediaLibraryEntry,
  listMediaLibrary,
} from "@/server/media/library";
import {mediaBucket} from "@/server/media/storage";
import {managedMediaObjectKey} from "@/server/media/deletions";

export const listAdminMediaLibrary: APIRoute = async () =>
  jsonResponse({items: await listMediaLibrary(env.FEED_DB)});

export const getAdminMediaLibraryEntry: APIRoute = async ({params}) => {
  const entry = params.entryId
    ? await getMediaLibraryEntry(env.FEED_DB, params.entryId)
    : null;
  return entry
    ? jsonResponse(entry)
    : jsonResponse({error: "Media library entry not found."}, {status: 404});
};

/**
 * Deletes a media library entry and its underlying R2 object. The R2 deletion
 * is best-effort: the library record is removed first so the Admin grid stops
 * showing the entry even if the object deletion is retried later.
 */
export const deleteAdminMediaLibraryEntry: APIRoute = async ({params}) => {
  if (!params.entryId) {
    return jsonResponse({error: "Invalid media library entry."}, {status: 400});
  }
  const entry = await deleteMediaLibraryEntry(env.FEED_DB, params.entryId);
  if (!entry) {
    return jsonResponse({error: "Media library entry not found."}, {status: 404});
  }
  const bucket = mediaBucket(env);
  const objectKey = managedMediaObjectKey(entry.url);
  if (bucket && objectKey) {
    await bucket.delete(objectKey).catch((error: unknown) => {
      console.error(JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        message: "Best-effort R2 deletion for a media library entry failed",
        objectKey,
      }));
    });
  }
  return jsonResponse({});
};
