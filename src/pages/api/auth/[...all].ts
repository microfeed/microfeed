import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";

import {createMicrofeedAuth} from "@/server/auth/better-auth";

export const prerender = false;

export async function hasExactRegisteredRedirect(request: Request): Promise<boolean> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/auth/oauth2/authorize") return true;

  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  if (!clientId || !redirectUri) return true;

  const client = await env.FEED_DB.prepare(
    'SELECT "redirectUris" FROM "oauth_client" WHERE "clientId" = ? LIMIT 1',
  ).bind(clientId).first<{redirectUris: string}>();
  if (!client) return true;

  try {
    const registered = JSON.parse(client.redirectUris) as unknown;
    return Array.isArray(registered) && registered.includes(redirectUri);
  } catch {
    return false;
  }
}

export const ALL: APIRoute = async ({request}) => {
  if (!await hasExactRegisteredRedirect(request)) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "The redirect_uri is not registered for this client.",
      },
      {
        headers: {"cache-control": "no-store"},
        status: 400,
      },
    );
  }
  return createMicrofeedAuth(env, request).handler(request);
};
