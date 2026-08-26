import {cache, env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {
  apiSiteFileInputSchema,
  apiSiteFilePreviewInputSchema,
} from "@/shared/ApiSchemas";
import FeedDb from "@/server/feed/FeedDb";
import {jsonResponse} from "@/server/http";
import {
  createSiteFile,
  deleteSiteFile,
  getSiteFileById,
  listAdminSiteFileSummaries,
  previewSiteFile,
  publishSiteFile,
  resetSiteFile,
  SiteFileConflictError,
  SiteFileRequestError,
  updateSiteFile,
} from "@/server/site-files/service";
import {
  contentMutationWebhookCommit,
  singleWebhookEventCommit,
} from "@/server/webhooks/emission";

function serviceError(error: unknown): Response | undefined {
  if (error instanceof SiteFileRequestError) {
    return jsonResponse({error: error.message}, {status: 400});
  }
  if (error instanceof SiteFileConflictError) {
    return jsonResponse({error: error.message}, {status: 409});
  }
  return undefined;
}

function database(request: Request): FeedDb {
  return new FeedDb(env, request, cache);
}

export const listAdminSiteFiles: APIRoute = async () =>
  jsonResponse(
    {items: await listAdminSiteFileSummaries(env.FEED_DB)},
    {headers: {"cache-control": "private, no-store"}},
  );

export const createAdminSiteFile: APIRoute = async ({request}) => {
  const parsed = apiSiteFileInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success || !parsed.data.filename) {
    return jsonResponse({error: "Invalid Site File."}, {status: 400});
  }
  try {
    const siteFile = await createSiteFile(
      database(request),
      request,
      parsed.data,
      contentMutationWebhookCommit(env, request, {
        context: {origin: "dashboard"},
        id: (result) => result.id,
        kind: "site_file",
        mutation: "created",
      }),
    );
    return jsonResponse(siteFile, {status: 201});
  } catch (error) {
    const response = serviceError(error);
    if (response) return response;
    throw error;
  }
};

export const getAdminSiteFile: APIRoute = async ({params, request}) => {
  const siteFile = params.siteFileId
    ? await getSiteFileById(env.FEED_DB, request, params.siteFileId)
    : null;
  return siteFile
    ? jsonResponse(siteFile)
    : jsonResponse({error: "Site File not found."}, {status: 404});
};

export const updateAdminSiteFile: APIRoute = async ({params, request}) => {
  const parsed = apiSiteFileInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success || !params.siteFileId) {
    return jsonResponse({error: "Invalid Site File."}, {status: 400});
  }
  try {
    const before = await getSiteFileById(
      env.FEED_DB,
      request,
      params.siteFileId,
    );
    const siteFile = await updateSiteFile(
      database(request),
      request,
      params.siteFileId,
      parsed.data,
      contentMutationWebhookCommit(env, request, {
        before: before as unknown as Record<string, unknown> | null,
        context: {origin: "dashboard"},
        id: params.siteFileId,
        kind: "site_file",
        mutation: "updated",
      }),
    );
    if (!siteFile) {
      return jsonResponse({error: "Site File not found."}, {status: 404});
    }
    return jsonResponse(siteFile);
  } catch (error) {
    const response = serviceError(error);
    if (response) return response;
    throw error;
  }
};

export const previewAdminSiteFile: APIRoute = async ({request}) => {
  const parsed = apiSiteFilePreviewInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success || (!parsed.data.filename && !parsed.data.site_file_id)) {
    return jsonResponse({error: "Invalid Site File."}, {status: 400});
  }
  try {
    const preview = await previewSiteFile(
      database(request),
      request,
      parsed.data,
    );
    return preview
      ? jsonResponse(preview, {
          headers: {"cache-control": "private, no-store"},
        })
      : jsonResponse({error: "Site File not found."}, {status: 404});
  } catch (error) {
    const response = serviceError(error);
    if (response) return response;
    throw error;
  }
};

export const deleteAdminSiteFile: APIRoute = async ({params, request}) => {
  if (!params.siteFileId) {
    return jsonResponse({error: "Invalid Site File ID."}, {status: 400});
  }
  try {
    const before = await getSiteFileById(
      env.FEED_DB,
      request,
      params.siteFileId,
    );
    if (!await deleteSiteFile(
      database(request),
      params.siteFileId,
      contentMutationWebhookCommit(env, request, {
        before: before as unknown as Record<string, unknown> | null,
        context: {origin: "dashboard"},
        id: params.siteFileId,
        kind: "site_file",
        mutation: "deleted",
      }),
    )) {
      return jsonResponse({error: "Site File not found."}, {status: 404});
    }
    return jsonResponse({});
  } catch (error) {
    const response = serviceError(error);
    if (response) return response;
    throw error;
  }
};

async function mutate(
  context: Parameters<APIRoute>[0],
  action: typeof publishSiteFile | typeof resetSiteFile,
): Promise<Response> {
  if (!context.params.siteFileId) {
    return jsonResponse({error: "Invalid Site File ID."}, {status: 400});
  }
  try {
    const siteFile = await action(
      database(context.request),
      context.request,
      context.params.siteFileId,
      singleWebhookEventCommit(env, context.request, (result) => ({
        object: result as unknown as Record<string, unknown>,
        subjectId: result.id,
        subjectType: "site_file",
        type: action === publishSiteFile
          ? "site_file.published"
          : "site_file.reset",
      }), {origin: "dashboard"}),
    );
    if (!siteFile) {
      return jsonResponse({error: "Site File not found."}, {status: 404});
    }
    return jsonResponse(siteFile);
  } catch (error) {
    const response = serviceError(error);
    if (response) return response;
    throw error;
  }
}

export const publishAdminSiteFile: APIRoute = (context) =>
  mutate(context, publishSiteFile);
export const resetAdminSiteFile: APIRoute = (context) =>
  mutate(context, resetSiteFile);
