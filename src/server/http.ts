export function jsonResponse(
  data: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json;charset=UTF-8");
  }
  return new Response(JSON.stringify(data), {...init, headers});
}
