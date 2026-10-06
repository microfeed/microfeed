import type {APIRoute} from "astro";
import {tagFeedResponse} from "@/server/tags/public";
export const GET: APIRoute = ({request, params}) => tagFeedResponse(request, params.slug ?? "", "json");
export const HEAD = GET;
