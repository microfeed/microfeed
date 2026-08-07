import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";

import {createPasskeyStepUpCookie} from "@/server/auth/account-security";
import {createMicrofeedAuth} from "@/server/auth/better-auth";
import {jsonResponse} from "@/server/http";

export const POST: APIRoute = async ({locals, request}) => {
  const userId = locals.authUser?.id;
  if (!userId) return new Response("Not found", {status: 404});
  const body = await request.json().catch(() => null) as {
    action?: unknown;
    passkeyId?: unknown;
    password?: unknown;
  } | null;
  const action = body?.action;
  const passkeyId = typeof body?.passkeyId === "string" ? body.passkeyId : undefined;
  if ((action !== "add" && action !== "delete") ||
      typeof body?.password !== "string" ||
      (action === "delete" && !passkeyId)) {
    return jsonResponse({error: "Invalid passkey confirmation."}, {status: 400});
  }
  if (action === "delete") {
    const owned = await env.FEED_DB.prepare(
      `SELECT "id" FROM "passkey" WHERE "id" = ?1 AND "userId" = ?2`,
    ).bind(passkeyId, userId).first();
    if (!owned) return new Response("Not found", {status: 404});
  }
  try {
    await createMicrofeedAuth(env, request).api.verifyPassword({
      body: {password: body.password},
      headers: request.headers,
    });
  } catch {
    return jsonResponse({error: "The current password is incorrect."}, {status: 400});
  }
  const headers = new Headers({"content-type": "application/json; charset=utf-8"});
  headers.append("set-cookie", await createPasskeyStepUpCookie(
    request,
    env.BETTER_AUTH_SECRET,
    {action, passkeyId, userId},
  ));
  return new Response(JSON.stringify({confirmed: true}), {headers});
};
