import type {APIRoute} from "astro";

export const GET: APIRoute = ({url}) =>
  Response.redirect(new URL("/api/", url), 308);
