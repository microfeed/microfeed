import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";

import {legacyApiReferenceRedirect} from "@/server/api/reference";

export const GET: APIRoute = ({url}) =>
  legacyApiReferenceRedirect(env.FEED_DB, url, "/api/openapi.yaml");

export const HEAD = GET;
