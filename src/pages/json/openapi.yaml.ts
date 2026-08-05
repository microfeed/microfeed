import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";

import {legacyApiReferenceRedirect} from "@/server/api/reference";
import {API_BASE_PATH} from "@/shared/ApiVersion";

export const GET: APIRoute = ({url}) =>
  legacyApiReferenceRedirect(
    env.FEED_DB,
    url,
    `${API_BASE_PATH}openapi.yaml`,
  );

export const HEAD = GET;
