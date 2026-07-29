import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {getMediaResponse} from "@/server/media/media";

export const GET: APIRoute = ({params, request}) =>
  getMediaResponse(request, env, params.key);
export const HEAD: APIRoute = ({params, request}) =>
  getMediaResponse(request, env, params.key);
export const ALL: APIRoute = () => new Response("Method Not Allowed", {
  headers: {allow: "GET, HEAD"},
  status: 405,
});
