import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";

import {
  createMicrofeedAuth,
  withAuthSessionCookies,
} from "@/server/auth/better-auth";
import {jsonResponse} from "@/server/http";

export const POST: APIRoute = async ({locals, request}) => {
  if (!locals.authUser?.id) return new Response("Not found", {status: 404});
  const body = await request.json().catch(() => null) as {
    currentPassword?: unknown;
    newPassword?: unknown;
    confirmation?: unknown;
  } | null;
  if (typeof body?.currentPassword !== "string" ||
      typeof body.newPassword !== "string" ||
      body.newPassword.length < 12 || body.newPassword.length > 128 ||
      body.newPassword !== body.confirmation) {
    return jsonResponse({error: "Enter matching passwords of 12–128 characters."}, {status: 400});
  }
  try {
    const changed = await createMicrofeedAuth(env, request).api.changePassword({
      body: {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        revokeOtherSessions: true,
      },
      headers: request.headers,
      returnHeaders: true,
    });
    return withAuthSessionCookies(
      jsonResponse({changed: true}),
      changed.headers,
    );
  } catch {
    return jsonResponse({error: "The current password is incorrect."}, {status: 400});
  }
};
