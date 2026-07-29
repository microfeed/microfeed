import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";

import {createMicrofeedAuth} from "@/server/auth/better-auth";

export const prerender = false;

export const ALL: APIRoute = async ({request}) => {
  return createMicrofeedAuth(env, request).handler(request);
};
