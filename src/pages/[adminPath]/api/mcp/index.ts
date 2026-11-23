import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";
import {adminUrl} from "@/shared/AdminPath";

export const GET: APIRoute = ({url}) =>
  Response.redirect(new URL(adminUrl("mcp", env.MICROFEED_ADMIN_PATH), url), 302);
export const HEAD = GET;
