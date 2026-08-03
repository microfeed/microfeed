export const MEDIA_STORAGE_UNAVAILABLE_CODE =
  "media_storage_unavailable" as const;

function isR2Bucket(value: unknown): value is R2Bucket {
  if (!value || typeof value !== "object") {
    return false;
  }
  return ["get", "head", "put"].every(
    (method) => typeof Reflect.get(value, method) === "function",
  );
}

export function mediaBucket(runtimeEnv: Env): R2Bucket | null {
  const binding = Reflect.get(runtimeEnv, "MEDIA_BUCKET");
  return isR2Bucket(binding) ? binding : null;
}

export function mediaStorageUnavailableResponse(
  headers?: HeadersInit,
): Response {
  return Response.json(
    {
      code: MEDIA_STORAGE_UNAVAILABLE_CODE,
      error:
        "Media storage is not configured. Enable R2 for this microfeed instance.",
    },
    {headers, status: 503},
  );
}
