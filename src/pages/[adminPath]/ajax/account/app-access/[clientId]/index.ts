import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";

import {revokeOAuthApplicationAccess} from "@/server/auth/oauth-admin";

export const DELETE: APIRoute = async ({locals, params}) => {
  const userId = locals.authUser?.id;
  const clientId = params.clientId;
  if (!userId || !clientId) return new Response("Not found", {status: 404});
  return await revokeOAuthApplicationAccess(env.FEED_DB, userId, clientId)
    ? new Response(null, {status: 204})
    : new Response("Not found", {status: 404});
};
