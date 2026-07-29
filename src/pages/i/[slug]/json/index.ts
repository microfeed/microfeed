import type {APIRoute} from "astro";
import {jsonFeedResponse, publicFeedHead} from "@/server/feed/responses";

export const GET: APIRoute = ({params, request}) =>
  jsonFeedResponse(request, true, params.slug);
export const HEAD: APIRoute = () => publicFeedHead();
