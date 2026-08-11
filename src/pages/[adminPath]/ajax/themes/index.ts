import {cache, env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "@/server/http";
import ThemeStore from "@/server/themes/ThemeStore";
import {parseThemeListOptions} from "@/shared/themes/ThemeListing";

function errorResponse(error: unknown): Response {
  return jsonResponse({
    error: error instanceof Error ? error.message : String(error),
  }, {status: 400});
}

export const GET: APIRoute = async ({request}) => {
  try {
    const options = parseThemeListOptions(new URL(request.url).searchParams);
    return jsonResponse(
      await new ThemeStore(env.FEED_DB, cache).listSummaries(options),
    );
  } catch (error) {
    return errorResponse(error);
  }
};

export const POST: APIRoute = async ({request}) => {
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || typeof input.action !== "string") {
    return jsonResponse({error: "A theme action is required."}, {status: 400});
  }
  const store = new ThemeStore(env.FEED_DB, cache);
  try {
    if (input.action === "customize") {
      const originKind = input.originKind;
      if (originKind === "theme" && typeof input.themeId === "string") {
        const source = await store.getVersion(input.themeId);
        if (!source) return jsonResponse({error: "Theme not found."}, {status: 404});
        const draft = await store.createDraft({
          assetOwnerThemeId: source.assetOwnerThemeId,
          bundle: source.bundle,
          manifest: source.manifest,
          originKind,
          originThemeId: source.id,
        });
        return jsonResponse({draft}, {status: 201});
      }
      return jsonResponse({error: "Choose an installed theme version."}, {status: 400});
    }
    if (input.action === "activate" && typeof input.themeId === "string") {
      return jsonResponse({state: await store.activate(input.themeId)});
    }
    if (input.action === "deactivate") {
      return jsonResponse({state: await store.deactivate()});
    }
    if (input.action === "rollback") {
      return jsonResponse({state: await store.rollback()});
    }
    return jsonResponse({error: "Unknown theme action."}, {status: 400});
  } catch (error) {
    return errorResponse(error);
  }
};
