import {normalizeObjectKey} from "./uploads";
import {
  mediaBucket,
  mediaStorageUnavailableResponse,
} from "./storage";

function objectHeaders(object: R2Object): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("accept-ranges", "bytes");
  headers.set("etag", object.httpEtag);
  headers.set("last-modified", object.uploaded.toUTCString());
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "public, max-age=3600");
  }
  return headers;
}

function etagMatches(
  value: string,
  etag: string,
  allowWeak = false,
): boolean {
  const normalize = (candidate: string) => allowWeak
    ? candidate.trim().replace(/^W\//iu, "")
    : candidate.trim();
  return value.trim() === "*" ||
    value.split(",").some((candidate) => {
      const normalized = normalize(candidate);
      return (
        normalized === normalize(etag) &&
        (allowWeak || !/^W\//iu.test(candidate.trim()))
      );
    });
}

function conditionalStatus(
  request: Request,
  object: R2Object,
): 304 | 412 | null {
  const ifMatch = request.headers.get("if-match");
  if (ifMatch && !etagMatches(ifMatch, object.httpEtag)) {
    return 412;
  }
  const ifUnmodifiedSince = request.headers.get("if-unmodified-since");
  if (
    ifUnmodifiedSince &&
    object.uploaded.getTime() > new Date(ifUnmodifiedSince).getTime()
  ) {
    return 412;
  }
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && etagMatches(ifNoneMatch, object.httpEtag, true)) {
    return 304;
  }
  if (!ifNoneMatch) {
    const ifModifiedSince = request.headers.get("if-modified-since");
    if (
      ifModifiedSince &&
      object.uploaded.getTime() <= new Date(ifModifiedSince).getTime()
    ) {
      return 304;
    }
  }
  return null;
}

function headRange(
  value: string,
  size: number,
): {end: number; length: number; start: number} | null {
  if (size <= 0) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value.trim());
  if (!match || (!match[1] && !match[2])) {
    return null;
  }
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }
    const length = Math.min(suffixLength, size);
    return {end: size - 1, length, start: size - length};
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= size ||
    requestedEnd < start
  ) {
    return null;
  }
  const end = Math.min(requestedEnd, size - 1);
  return {end, length: end - start + 1, start};
}

export async function getMediaResponse(
  request: Request,
  runtimeEnv: Env,
  rawKey: string | undefined,
): Promise<Response> {
  const bucket = mediaBucket(runtimeEnv);
  if (!bucket) {
    return mediaStorageUnavailableResponse();
  }
  const key = rawKey ? normalizeObjectKey(rawKey) : null;
  if (!key) {
    return new Response("Not Found", {status: 404});
  }

  if (request.method === "HEAD") {
    const object = await bucket.head(key);
    if (!object) {
      return new Response(null, {status: 404});
    }
    const headers = objectHeaders(object);
    const condition = conditionalStatus(request, object);
    if (condition) {
      return new Response(null, {headers, status: condition});
    }
    const requestedRange = request.headers.get("range");
    if (requestedRange) {
      const range = headRange(requestedRange, object.size);
      if (!range) {
        headers.set("content-range", `bytes */${object.size}`);
        return new Response(null, {headers, status: 416});
      }
      headers.set(
        "content-range",
        `bytes ${range.start}-${range.end}/${object.size}`,
      );
      headers.set("content-length", String(range.length));
      return new Response(null, {headers, status: 206});
    }
    headers.set("content-length", String(object.size));
    return new Response(null, {headers});
  }

  const requestedRange = request.headers.get("range");
  if (requestedRange) {
    const metadata = await bucket.head(key);
    if (!metadata) {
      return new Response("Not Found", {status: 404});
    }
    if (!headRange(requestedRange, metadata.size)) {
      const headers = objectHeaders(metadata);
      headers.set("content-range", `bytes */${metadata.size}`);
      return new Response("Range Not Satisfiable", {headers, status: 416});
    }
  }

  try {
    const object = await bucket.get(key, {
      onlyIf: request.headers,
      range: request.headers,
    });
    if (!object) {
      return new Response("Not Found", {status: 404});
    }

    const headers = objectHeaders(object);
    if (!("body" in object)) {
      return new Response(null, {
        headers,
        status: conditionalStatus(request, object) ?? 412,
      });
    }

    let status = 200;
    if (
      request.headers.has("range") &&
      object.range &&
      "offset" in object.range
    ) {
      const offset = object.range.offset ?? 0;
      const length = object.range.length ?? object.size;
      headers.set(
        "content-range",
        `bytes ${offset}-${offset + length - 1}/${object.size}`,
      );
      headers.set("content-length", String(length));
      status = 206;
    } else {
      headers.set("content-length", String(object.size));
    }
    return new Response(object.body, {headers, status});
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("range") || error.message.includes("10039"))
    ) {
      return new Response("Range Not Satisfiable", {status: 416});
    }
    throw error;
  }
}
