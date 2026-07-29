import type {APIRoute} from "astro";

import {jsonFeedResponse, publicFeedHead} from "@/server/feed/responses";

export const GET: APIRoute = ({request}) => jsonFeedResponse(request, false);
export const HEAD: APIRoute = () => publicFeedHead();
