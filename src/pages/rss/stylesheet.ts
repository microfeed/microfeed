import type {APIRoute} from "astro";
import {rssStylesheetResponse} from "@/server/feed/responses";

export const GET: APIRoute = ({request}) => rssStylesheetResponse(request);
