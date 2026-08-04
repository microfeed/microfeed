import {env, waitUntil} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "../../../server/http";
import FeedDb from "@/server/feed/FeedDb";
import {
  parseDeleteImageRequest,
  scheduleBestEffortMediaDeletion,
} from "@/server/media/deletions";
import {createSignedUpload} from "@/server/media/uploads";
import {
  mediaBucket,
  mediaStorageUnavailableResponse,
} from "@/server/media/storage";
import type {UploadRequest} from "../../../types";

export const POST: APIRoute = async ({request}) => {
  if (!mediaBucket(env)) {
    return mediaStorageUnavailableResponse();
  }
  const input = await request.json() as UploadRequest;
  try {
    return jsonResponse(await createSignedUpload(request, env, input));
  } catch (error) {
    return jsonResponse(
      {error: error instanceof Error ? error.message : "Invalid upload request."},
      {status: 400},
    );
  }
};

export async function deleteAdminImage(
  request: Request,
  runtimeEnv: Env,
  schedule: (promise: Promise<unknown>) => void,
): Promise<Response> {
  let rawInput: unknown;
  try {
    rawInput = await request.json();
  } catch {
    return jsonResponse({error: "Invalid image deletion request."}, {status: 400});
  }
  const input = parseDeleteImageRequest(rawInput);
  if (!input) {
    return jsonResponse({error: "Invalid image deletion request."}, {status: 400});
  }

  try {
    const storedImageUrl = input.target
      ? await new FeedDb(runtimeEnv, request).removeImageMetadata(input.target)
      : null;
    const keys = scheduleBestEffortMediaDeletion(
      mediaBucket(runtimeEnv),
      [input.imageUrl, storedImageUrl],
      schedule,
    );
    return jsonResponse({deletedKeys: keys.length});
  } catch (error) {
    console.error(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      message: "Failed to remove image metadata",
    }));
    return jsonResponse({error: "Failed to remove image metadata."}, {status: 500});
  }
}

export const DELETE: APIRoute = async ({request}) =>
  deleteAdminImage(request, env, waitUntil);
