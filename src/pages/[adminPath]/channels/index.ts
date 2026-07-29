import type {APIRoute} from "astro";

export const GET: APIRoute = ({request, redirect}) =>
  redirect(new URL("primary/", request.url).pathname, 302);
