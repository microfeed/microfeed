import {cache, env} from "cloudflare:workers";
import type {APIRoute} from "astro";
import * as z from "zod";

import {
  apiPageCreateInputSchema,
  apiPageInputSchema,
  pageInputErrorMessage,
} from "@/shared/ApiSchemas";
import {jsonResponse} from "@/server/http";
import FeedDb from "@/server/feed/FeedDb";
import {
  activeThemeSupportsPages,
  createPage,
  deletePage,
  getPageById,
  listAdminPageSummaries,
  PageConflictError,
  PageRequestError,
  PageThemeUnsupportedError,
  reorderPageNavigation,
  updatePage,
} from "@/server/pages/service";
import {
  contentMutationWebhookCommit,
  singleWebhookEventCommit,
} from "@/server/webhooks/emission";

const pageNavigationOrderSchema = z.object({
  page_ids: z.array(z.string().min(1)).max(100),
});

function serviceError(error: unknown): Response | undefined {
  if (error instanceof PageRequestError) {
    return jsonResponse({error: error.message}, {status: 400});
  }
  if (error instanceof PageConflictError) {
    return jsonResponse({error: error.message}, {status: 409});
  }
  if (error instanceof PageThemeUnsupportedError) {
    return jsonResponse({error: error.message}, {status: 422});
  }
  return undefined;
}

function database(request: Request): FeedDb {
  return new FeedDb(env, request, cache);
}

export const listAdminPages: APIRoute = async () => {
  try {
    const [items, themeSupportsPages] = await Promise.all([
      listAdminPageSummaries(env.FEED_DB),
      activeThemeSupportsPages(env.FEED_DB),
    ]);
    return jsonResponse(
      {items, themeSupportsPages},
      {headers: {"cache-control": "private, no-store"}},
    );
  } catch (error) {
    const response = serviceError(error);
    if (response) return response;
    throw error;
  }
};

export const createAdminPage: APIRoute = async ({request}) => {
  const parsed = apiPageCreateInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success) {
    return jsonResponse(
      {error: pageInputErrorMessage(parsed.error)},
      {status: 400},
    );
  }
  try {
    const page = await createPage(database(request), request, parsed.data, {
      adminPath: env.MICROFEED_ADMIN_PATH,
      commit: contentMutationWebhookCommit(env, request, {
        context: {origin: "dashboard"},
        id: (result) => result.id,
        kind: "page",
        mutation: "created",
      }),
    });
    return jsonResponse(page, {status: 201});
  } catch (error) {
    const response = serviceError(error);
    if (response) return response;
    throw error;
  }
};

export const getAdminPage: APIRoute = async ({params, request}) => {
  const page = params.pageId
    ? await getPageById(env.FEED_DB, request, params.pageId)
    : null;
  return page
    ? jsonResponse(page)
    : jsonResponse({error: "Page not found."}, {status: 404});
};

export const reorderAdminPageNavigation: APIRoute = async ({request}) => {
  const parsed = pageNavigationOrderSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonResponse(
      {error: "Send each navigation Page once, in the order it should appear."},
      {status: 400},
    );
  }
  try {
    await reorderPageNavigation(
      database(request),
      parsed.data.page_ids,
      singleWebhookEventCommit(env, request, {
        changedFields: ["page_ids"],
        object: {id: "navigation", page_ids: parsed.data.page_ids},
        subjectId: "navigation",
        subjectType: "page",
        type: "page.navigation_updated",
      }, {origin: "dashboard"}),
    );
    return jsonResponse({});
  } catch (error) {
    const response = serviceError(error);
    if (response) return response;
    throw error;
  }
};

export const updateAdminPage: APIRoute = async ({params, request}) => {
  const parsed = apiPageInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success || !params.pageId) {
    return jsonResponse({
      error: !parsed.success
        ? pageInputErrorMessage(parsed.error)
        : "Choose a Page to update.",
    }, {status: 400});
  }
  try {
    const before = await getPageById(
      env.FEED_DB,
      request,
      params.pageId,
    );
    const page = await updatePage(
      database(request),
      request,
      params.pageId,
      parsed.data,
      {
        adminPath: env.MICROFEED_ADMIN_PATH,
        commit: contentMutationWebhookCommit(env, request, {
          before: before as unknown as Record<string, unknown> | null,
          context: {origin: "dashboard"},
          id: params.pageId,
          kind: "page",
          mutation: "updated",
        }),
      },
    );
    if (!page) return jsonResponse({error: "Page not found."}, {status: 404});
    return jsonResponse(page);
  } catch (error) {
    const response = serviceError(error);
    if (response) return response;
    throw error;
  }
};

export const deleteAdminPage: APIRoute = async ({params, request}) => {
  if (!params.pageId) {
    return jsonResponse({error: "Invalid Page ID."}, {status: 400});
  }
  try {
    const before = await getPageById(env.FEED_DB, request, params.pageId);
    if (!await deletePage(
      database(request),
      params.pageId,
      contentMutationWebhookCommit(env, request, {
        before: before as unknown as Record<string, unknown> | null,
        context: {origin: "dashboard"},
        id: params.pageId,
        kind: "page",
        mutation: "deleted",
      }),
    )) {
      return jsonResponse({error: "Page not found."}, {status: 404});
    }
    return jsonResponse({});
  } catch (error) {
    const response = serviceError(error);
    if (response) return response;
    throw error;
  }
};
