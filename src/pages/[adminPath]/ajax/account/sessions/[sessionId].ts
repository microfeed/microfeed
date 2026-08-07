import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";

import {revokeAccountSession} from "@/server/auth/account-admin";

export const DELETE: APIRoute = async ({locals, params}) => {
  const userId = locals.authUser?.id;
  const current = locals.authSession?.id;
  const sessionId = params.sessionId;
  if (!userId || !current || !sessionId) return new Response("Not found", {status: 404});
  return await revokeAccountSession(env.FEED_DB, userId, current, sessionId)
    ? new Response(null, {status: 204})
    : new Response("Not found", {status: 404});
};
