import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "@/server/http";
import {mediaBucket} from "@/server/media/storage";
import ThemeStore from "@/server/themes/ThemeStore";

export const GET: APIRoute = async ({params}) => {
  const draft = await new ThemeStore(env.FEED_DB).getDraft(params.draftId ?? "");
  return draft
    ? jsonResponse({draft})
    : jsonResponse({error: "Draft not found."}, {status: 404});
};

export const PUT: APIRoute = async ({params, request}) => {
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return jsonResponse({error: "A draft is required."}, {status: 400});
  try {
    const draft = await new ThemeStore(env.FEED_DB).saveDraft(
      params.draftId ?? "",
      {bundle: input.bundle as never, manifest: input.manifest as never},
    );
    return jsonResponse({draft});
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : String(error),
    }, {status: 400});
  }
};

export const POST: APIRoute = async ({params, request}) => {
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (input?.action !== "publish") {
    return jsonResponse({error: "Unknown draft action."}, {status: 400});
  }
  try {
    const theme = await new ThemeStore(env.FEED_DB).publishDraft(
      params.draftId ?? "",
    );
    return jsonResponse({theme}, {status: 201});
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : String(error),
    }, {status: 400});
  }
};

export const DELETE: APIRoute = async ({params}) => {
  await new ThemeStore(env.FEED_DB).discardDraft(
    params.draftId ?? "",
    mediaBucket(env),
  );
  return jsonResponse({});
};
