import type {APIRoute} from "astro";

import {OPENAPI_JSON} from "@/server/openapi/document";

export const GET: APIRoute = () => new Response(OPENAPI_JSON, {
  headers: {"content-type": "application/json; charset=utf-8"},
});
