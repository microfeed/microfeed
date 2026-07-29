import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {handleAdminBootstrap} from "@/server/auth/bootstrap";

export const prerender = false;

export const ALL: APIRoute = ({request}) => {
  return handleAdminBootstrap(env, request);
};
