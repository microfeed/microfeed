const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const FORM_CONTENT_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];
const OAUTH_MACHINE_ENDPOINTS = new Set([
  "/api/auth/oauth2/token",
  "/api/auth/oauth2/revoke",
  "/api/auth/oauth2/introspect",
]);

// Preserve Astro's form CSRF guard while permitting OAuth back-channel POSTs.
// Browser submissions still need the instance's Origin, including on these URLs.
export function isForbiddenFormRequest(request: Request, isPrerendered = false): boolean {
  if (isPrerendered || SAFE_METHODS.has(request.method)) return false;
  const type = request.headers.get("content-type");
  if (type !== null && !FORM_CONTENT_TYPES.some(value => type.toLowerCase().includes(value))) return false;
  const url = new URL(request.url);
  if (request.headers.get("origin") === url.origin) return false;
  const machineRequest = request.method === "POST" && OAUTH_MACHINE_ENDPOINTS.has(url.pathname) &&
    !request.headers.has("origin") && !request.headers.has("sec-fetch-site");
  return !machineRequest;
}
