import {apiKeyExists, readApiAccessSettings} from "./api-keys";

const PUBLIC_API_REFERENCE_PATHS = new Set([
  "/api/",
  "/api/openapi.html",
  "/api/openapi.json",
  "/api/openapi.yaml",
  "/api/llms.txt",
  "/api/llms-full.txt",
]);

export type ApiRequestDecision =
  | "allow-integration"
  | "allow-reference"
  | "not-found"
  | "unauthorized";

export function isPublicApiReferencePath(pathname: string): boolean {
  return PUBLIC_API_REFERENCE_PATHS.has(pathname);
}

export function isIntegrationApiPath(pathname: string): boolean {
  return pathname === "/api/feed/" ||
    pathname === "/api/items/" ||
    pathname.startsWith("/api/items/") ||
    pathname.startsWith("/api/channels/") ||
    pathname === "/api/media_files/presigned_urls/";
}

export function providedApiKey(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization) {
    const bearer = /^Bearer(?:\s+(.+))?$/iu.exec(authorization);
    if (bearer) {
      return bearer[1]?.trim() || "";
    }
  }
  return request.headers.get("x-microfeedapi-key")?.trim() || null;
}

export async function decideApiRequest(
  database: D1Database,
  request: Request,
  pathname: string,
): Promise<ApiRequestDecision> {
  const settings = await readApiAccessSettings(database);
  if (isPublicApiReferencePath(pathname)) {
    return settings.enabled && settings.publicDocsEnabled
      ? "allow-reference"
      : "not-found";
  }
  if (!isIntegrationApiPath(pathname) || !settings.enabled) {
    return "not-found";
  }
  const apiKey = providedApiKey(request);
  return apiKey && await apiKeyExists(database, apiKey)
    ? "allow-integration"
    : "unauthorized";
}
