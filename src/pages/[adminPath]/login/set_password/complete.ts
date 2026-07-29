import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {normalizeAdminPath} from "@/shared/AdminPath";
import {completeAdminPasswordSetup} from "@/server/auth/password-setup";

export const prerender = false;

export const ALL: APIRoute = ({request}) => {
  return completeAdminPasswordSetup(
    env.FEED_DB,
    request,
    normalizeAdminPath(env.MICROFEED_ADMIN_PATH),
  );
};
