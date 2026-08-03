import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "../../server/http";
import {
  mediaBucket,
  mediaStorageUnavailableResponse,
} from "@/server/media/storage";
import {normalizeObjectKey, verifySignedUpload} from "@/server/media/uploads";

const corsHeaders = {
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "PUT, OPTIONS",
  "access-control-allow-origin": "*",
};

export const PUT: APIRoute = async ({params, request, url}) => {
  const bucket = mediaBucket(env);
  if (!bucket) {
    return mediaStorageUnavailableResponse(corsHeaders);
  }
  const objectKey = params.key ? normalizeObjectKey(params.key) : null;
  const contentType = url.searchParams.get("content-type") ?? "";
  const sizeValue = url.searchParams.get("size") ?? "";
  if (!objectKey) {
    return new Response("Invalid media path", {status: 400});
  }
  const valid = await verifySignedUpload(
    objectKey,
    url.searchParams.get("expires"),
    url.searchParams.get("signature"),
    env.UPLOAD_SIGNING_KEY,
    contentType,
    undefined,
    sizeValue,
  );
  if (!valid) {
    return new Response("Invalid or expired upload URL", {status: 403});
  }
  if (!request.body) {
    return new Response("Upload body is required", {status: 400});
  }

  let body: ReadableStream = request.body;
  let piping: Promise<void> | undefined;
  if (sizeValue) {
    const fixedLength = new FixedLengthStream(Number(sizeValue));
    piping = request.body.pipeTo(fixedLength.writable);
    body = fixedLength.readable;
  }
  const put = bucket.put(objectKey, body, {
    httpMetadata: contentType ? {contentType} : request.headers,
  });
  const [object] = await Promise.all([put, piping]);
  return jsonResponse(
    {etag: object?.httpEtag ?? null},
    {headers: corsHeaders},
  );
};

export const OPTIONS: APIRoute = () => new Response(null, {
  headers: corsHeaders,
  status: 204,
});

export const ALL: APIRoute = () => new Response("Method Not Allowed", {
  headers: {allow: "PUT, OPTIONS"},
  status: 405,
});
