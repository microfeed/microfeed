import type {APIRoute} from "astro";

import {env} from "cloudflare:workers";
import {publicSiteFileResponse} from "@/server/site-files/public";

export const GET: APIRoute = ({request}) =>
  publicSiteFileResponse(env, request, "sitemap.xml");
