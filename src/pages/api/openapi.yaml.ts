import type {APIRoute} from "astro";

import {OPENAPI_YAML} from "@/server/openapi/document";

export const GET: APIRoute = () => new Response(OPENAPI_YAML, {
  headers: {"content-type": "application/yaml; charset=utf-8"},
});
