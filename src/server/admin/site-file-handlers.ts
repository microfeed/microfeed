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
  listSiteFiles,
  previewSiteFile,
  publishSiteFile,
  resetSiteFile,
  SiteFileConflictError,
  SiteFileRequestError,
  updateSiteFile,
} from "@/server/site-files/service";

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

export const listAdminSiteFiles: APIRoute = async ({request}) =>
  jsonResponse({items: await listSiteFiles(env.FEED_DB, request)});

export const createAdminSiteFile: APIRoute = async ({request}) => {
  const parsed = apiSiteFileInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success || !parsed.data.filename) {
    return jsonResponse({error: "Invalid Site File."}, {status: 400});
  }
  try {
    return jsonResponse(
      await createSiteFile(database(request), request, parsed.data),
      {status: 201},
    );
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
    const siteFile = await updateSiteFile(
      database(request),
      request,
      params.siteFileId,
      parsed.data,
    );
    return siteFile
      ? jsonResponse(siteFile)
      : jsonResponse({error: "Site File not found."}, {status: 404});
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
    return await deleteSiteFile(database(request), params.siteFileId)
      ? jsonResponse({})
      : jsonResponse({error: "Site File not found."}, {status: 404});
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
    );
    return siteFile
      ? jsonResponse(siteFile)
      : jsonResponse({error: "Site File not found."}, {status: 404});
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
