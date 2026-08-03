import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "../../../server/http";
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
