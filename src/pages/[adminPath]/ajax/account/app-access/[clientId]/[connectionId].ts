import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";

import {revokeOAuthConnectionAndTokens} from "@/server/auth/oauth-admin";

export const DELETE: APIRoute = async ({locals, params}) => {
  const userId = locals.authUser?.id;
  const clientId = params.clientId;
  const value = params.connectionId;
  if (!userId || !clientId || !value) return new Response("Not found", {status: 404});
  const connectionId = value === "legacy" ? null : value;
  return await revokeOAuthConnectionAndTokens(
    env.FEED_DB,
    userId,
    clientId,
    connectionId,
  ) ? new Response(null, {status: 204}) : new Response("Not found", {status: 404});
};
