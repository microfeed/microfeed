import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";

import {revokeOAuthConsentAndTokens} from "@/server/auth/oauth-admin";

export const DELETE: APIRoute = async ({locals, params}) => {
  const userId = locals.authUser?.id;
  const consentId = params.consentId;
  if (!userId || !consentId) return new Response("Not found", {status: 404});
  return await revokeOAuthConsentAndTokens(env.FEED_DB, userId, consentId)
    ? new Response(null, {status: 204})
    : new Response("Not found", {status: 404});
};
