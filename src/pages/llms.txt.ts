import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {publicSiteFileResponse} from "@/server/site-files/public";

export const GET: APIRoute = ({request}) =>
  publicSiteFileResponse(env, request, "llms.txt");
