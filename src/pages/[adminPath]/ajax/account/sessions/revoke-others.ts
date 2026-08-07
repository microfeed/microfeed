import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";

import {revokeOtherAccountSessions} from "@/server/auth/account-admin";
import {jsonResponse} from "@/server/http";

export const POST: APIRoute = async ({locals}) => {
  const userId = locals.authUser?.id;
  const current = locals.authSession?.id;
  if (!userId || !current) return new Response("Not found", {status: 404});
  return jsonResponse({revoked: await revokeOtherAccountSessions(
    env.FEED_DB,
    userId,
    current,
  )});
};
