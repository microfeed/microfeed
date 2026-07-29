import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {normalizeAdminPath} from "@/shared/AdminPath";
import {handleAdminPasswordSetupEntry} from "@/server/auth/password-setup";

export const prerender = false;

export const ALL: APIRoute = ({params, request}) => {
  return handleAdminPasswordSetupEntry(
    env.FEED_DB,
    request,
    normalizeAdminPath(env.MICROFEED_ADMIN_PATH),
    params.token ?? "",
  );
};
