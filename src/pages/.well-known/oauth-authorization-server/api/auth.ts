import {oauthProviderAuthServerMetadata} from "@better-auth/oauth-provider";
import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";

import {builtInAdminAuthEnabled} from "@/shared/AdminAuth";
import {createMicrofeedAuth} from "@/server/auth/better-auth";

export const prerender = false;

export const GET: APIRoute = async ({request}) => {
  if (!builtInAdminAuthEnabled(env.MICROFEED_ADMIN_AUTH_MODE)) {
    return new Response("404", {status: 404});
  }
  return oauthProviderAuthServerMetadata(
    createMicrofeedAuth(env, request),
  )(request);
};
