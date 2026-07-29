import type {APIRoute} from "astro";

export const GET: APIRoute = ({request, redirect}) =>
  redirect(new URL("list/", request.url).pathname, 302);
