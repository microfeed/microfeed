import {cache, env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "@/server/http";
import ThemeStore from "@/server/themes/ThemeStore";
import {
  singleWebhookEventCommit,
  webhookEventsCommit,
} from "@/server/webhooks/emission";
import {parseThemeListOptions} from "@/shared/themes/ThemeListing";
import {webhookThemeSnapshot} from "@/shared/WebhookExamples";

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
          previewFixture: source.previewFixture,
        });
        return jsonResponse({draft}, {status: 201});
      }
      return jsonResponse({error: "Choose an installed theme version."}, {status: 400});
    }
    if (input.action === "activate" && typeof input.themeId === "string") {
      const before = await store.getState();
      const [theme, previous] = await Promise.all([
        store.getVersion(input.themeId),
        before.activeThemeId
          ? store.getVersion(before.activeThemeId, true)
          : null,
      ]);
      const state = await store.activate(
        input.themeId,
        webhookEventsCommit(env, request, (result) => {
          if (
            before.activeThemeId === result.activeThemeId ||
            !result.activeThemeId
          ) return [];
          return [
            ...(before.activeThemeId
              ? [{
                  changedFields: ["active_theme_id"],
                  object: previous
                    ? webhookThemeSnapshot(previous)
                    : {id: before.activeThemeId},
                  subjectId: before.activeThemeId,
                  subjectType: "theme" as const,
                  type: "theme.deactivated" as const,
                }]
              : []),
            {
              changedFields: ["active_theme_id"],
              object: theme
                ? webhookThemeSnapshot(theme)
                : {id: result.activeThemeId},
              subjectId: result.activeThemeId,
              subjectType: "theme" as const,
              type: "theme.activated" as const,
            },
          ];
        }, {origin: "dashboard"}),
      );
      return jsonResponse({state});
    }
    if (input.action === "deactivate") {
      const before = await store.getState();
      const theme = before.activeThemeId
        ? await store.getVersion(before.activeThemeId, true)
        : null;
      const state = await store.deactivate(
        singleWebhookEventCommit(env, request, () =>
          before.activeThemeId
            ? {
                changedFields: ["active_theme_id"],
                object: theme
                  ? webhookThemeSnapshot(theme)
                  : {id: before.activeThemeId},
                subjectId: before.activeThemeId,
                subjectType: "theme",
                type: "theme.deactivated",
              }
            : null, {origin: "dashboard"}),
      );
      return jsonResponse({state});
    }
    if (input.action === "rollback") {
      const before = await store.getState();
      const [previous, active] = await Promise.all([
        before.activeThemeId
          ? store.getVersion(before.activeThemeId, true)
          : null,
        before.previousThemeId
          ? store.getVersion(before.previousThemeId)
          : null,
      ]);
      const state = await store.rollback(
        webhookEventsCommit(env, request, (result) => {
          if (before.activeThemeId === result.activeThemeId) return [];
          return [
            ...(before.activeThemeId
              ? [{
                  changedFields: ["active_theme_id"],
                  object: previous
                    ? webhookThemeSnapshot(previous)
                    : {id: before.activeThemeId},
                  subjectId: before.activeThemeId,
                  subjectType: "theme" as const,
                  type: "theme.deactivated" as const,
                }]
              : []),
            ...(result.activeThemeId
              ? [{
                  changedFields: ["active_theme_id"],
                  object: active
                    ? webhookThemeSnapshot(active)
                    : {id: result.activeThemeId},
                  subjectId: result.activeThemeId,
                  subjectType: "theme" as const,
                  type: "theme.activated" as const,
                }]
              : []),
          ];
        }, {origin: "dashboard"}),
      );
      return jsonResponse({state});
    }
    return jsonResponse({error: "Unknown theme action."}, {status: 400});
  } catch (error) {
    return errorResponse(error);
  }
};
