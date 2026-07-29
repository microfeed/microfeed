import type {APIRoute} from "astro";
import {rssFeedResponse} from "@/server/feed/responses";

export const GET: APIRoute = ({params, request}) =>
  rssFeedResponse(request, params.slug);
