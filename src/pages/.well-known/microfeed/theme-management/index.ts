import {cache, env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "@/server/http";
import {mediaBucket} from "@/server/media/storage";
import ThemeStore from "@/server/themes/ThemeStore";
import {sha256Hex} from "@/shared/themes/ThemeRenderer";

export const POST: APIRoute = async ({request}) => {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (token.length < 32 || token.length > 512) {
    return new Response("Unauthorized", {status: 401});
  }
  const tokenHash = await sha256Hex(token);
  const grant = await env.FEED_DB.prepare(
    `DELETE FROM theme_management_tokens
     WHERE token_hash = ? AND expires_at_ms >= ?
     RETURNING action, theme_id`,
  ).bind(tokenHash, Date.now()).first<{action: string; theme_id: string | null}>();
  if (!grant) return new Response("Unauthorized", {status: 401});

  const store = new ThemeStore(env.FEED_DB, cache);
  try {
    if (grant.action === "activate" && grant.theme_id) {
      return jsonResponse({state: await store.activate(grant.theme_id)});
    }
    if (grant.action === "deactivate") {
      return jsonResponse({state: await store.deactivate()});
    }
    if (grant.action === "rollback") {
      return jsonResponse({state: await store.rollback()});
    }
    if (grant.action === "delete" && grant.theme_id) {
      await store.deleteVersion(grant.theme_id, mediaBucket(env));
      return jsonResponse({});
    }
    return jsonResponse({error: "Invalid management grant."}, {status: 400});
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : String(error),
    }, {status: 400});
  }
};

export const ALL: APIRoute = () => new Response("Method Not Allowed", {
  headers: {allow: "POST"},
  status: 405,
});
