import type {APIRoute} from "astro";
import {podcastChaptersResponse} from "@/server/feed/responses";

export const GET: APIRoute = ({params, request}) => podcastChaptersResponse(request, params.slug!);
export const HEAD: APIRoute = GET;
