import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";
import Mustache from "mustache";

import {adminBasePath} from "@/shared/AdminPath";
import {MICROFEED_VERSION} from "@/shared/Version";
import OPENAPI_YAML from "@/server/openapi/openapi.yaml?raw";
import {publicFeedHead} from "@/server/feed/responses";

export const GET: APIRoute = ({url}) => new Response(
  Mustache.render(OPENAPI_YAML, {
    baseUrl: url.origin,
    adminBasePath: adminBasePath(env.MICROFEED_ADMIN_PATH),
    microfeedVersion: MICROFEED_VERSION,
  }),
  {headers: {"content-type": "text/yaml; charset=utf-8"}},
);

export const HEAD: APIRoute = () => publicFeedHead();
