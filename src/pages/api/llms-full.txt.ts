import type {APIRoute} from "astro";

import {API_LLMS_FULL_TEXT} from "@/server/openapi/document";

export const GET: APIRoute = () => new Response(API_LLMS_FULL_TEXT, {
  headers: {"content-type": "text/plain; charset=utf-8"},
});
