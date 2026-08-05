import {apiKeyExists, readApiAccessSettings} from "./api-keys";
import {
  API_BASE_PATH,
  LEGACY_API_BASE_PATH,
  LEGACY_API_DEPRECATION,
} from "@/shared/ApiVersion";

const PUBLIC_API_REFERENCE_SUFFIXES = new Set([
  "",
  "openapi.html",
  "openapi.json",
  "openapi.yaml",
  "llms.txt",
  "llms-full.txt",
]);

export interface ApiPathDetails {
  canonicalPath: string;
  kind: "integration" | "reference";
  legacy: boolean;
}

export type ApiRequestDecision =
  | "allow-integration"
  | "allow-reference"
  | "not-found"
  | "unauthorized";

function integrationSuffix(suffix: string): boolean {
  return suffix === "feed/" ||
    suffix === "items/" ||
    /^items\/[^/]+\/$/u.test(suffix) ||
    /^channels\/[^/]+\/$/u.test(suffix) ||
    suffix === "media_files/presigned_urls/";
}

export function apiPathDetails(pathname: string): ApiPathDetails | null {
  const bases = [
    {base: API_BASE_PATH, legacy: false},
    {base: LEGACY_API_BASE_PATH, legacy: true},
  ] as const;

  for (const {base, legacy} of bases) {
    if (!pathname.startsWith(base)) continue;
    const suffix = pathname.slice(base.length);
    if (PUBLIC_API_REFERENCE_SUFFIXES.has(suffix)) {
      return {
        canonicalPath: `${API_BASE_PATH}${suffix}`,
        kind: "reference",
        legacy,
      };
    }
    if (integrationSuffix(suffix)) {
      return {
        canonicalPath: `${API_BASE_PATH}${suffix}`,
        kind: "integration",
        legacy,
      };
    }
    return null;
  }
  return null;
}

export function isPublicApiReferencePath(pathname: string): boolean {
  return apiPathDetails(pathname)?.kind === "reference";
}

export function isIntegrationApiPath(pathname: string): boolean {
  return apiPathDetails(pathname)?.kind === "integration";
}

export function addLegacyApiDeprecationHeaders(
  response: Response,
  requestUrl: URL,
  pathname: string,
): Response {
  const details = apiPathDetails(pathname);
  if (!details?.legacy) return response;

  const successor = new URL(details.canonicalPath, requestUrl);
  successor.search = requestUrl.search;
  const headers = new Headers(response.headers);
  headers.set("deprecation", LEGACY_API_DEPRECATION);
  headers.append(
    "link",
    `<${successor.toString()}>; rel="successor-version"`,
  );
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
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
  const details = apiPathDetails(pathname);
  if (details?.kind === "reference") {
    return settings.enabled && settings.publicDocsEnabled
      ? "allow-reference"
      : "not-found";
  }
  if (details?.kind !== "integration" || !settings.enabled) {
    return "not-found";
  }
  const apiKey = providedApiKey(request);
  return apiKey && await apiKeyExists(database, apiKey)
    ? "allow-integration"
    : "unauthorized";
}
