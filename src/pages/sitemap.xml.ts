import type {APIRoute} from "astro";

import {sitemapResponse} from "@/server/feed/responses";

export const GET: APIRoute = ({request}) => sitemapResponse(request);
