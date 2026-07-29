import type {APIRoute} from "astro";
import {publicFeedHead, rssFeedResponse} from "@/server/feed/responses";

export const GET: APIRoute = ({request}) => rssFeedResponse(request);
export const HEAD: APIRoute = () => publicFeedHead();
