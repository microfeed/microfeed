import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "@/server/http";
import {
  SeriesConflictError,
  SeriesRequestError,
  createSeries,
  deleteSeries,
  getSeriesById,
  listSeries,
  updateSeries,
} from "@/server/series/service";
import {SERIES_KIND_VALUES, type SeriesKind} from "@/shared/Series";

function serviceError(error: unknown): Response | undefined {
  if (error instanceof SeriesRequestError) {
    return jsonResponse({error: error.message}, {status: 400});
  }
  if (error instanceof SeriesConflictError) {
    return jsonResponse({error: error.message}, {status: 409});
  }
  return undefined;
}

function parseKind(value: unknown): SeriesKind | undefined {
  return SERIES_KIND_VALUES.includes(value as SeriesKind)
    ? (value as SeriesKind)
    : undefined;
}

export const listAdminSeries: APIRoute = async ({request}) => {
  const url = new URL(request.url);
  const kind = parseKind(url.searchParams.get("kind"));
  return jsonResponse({items: await listSeries(env.FEED_DB, kind)});
};

export const createAdminSeries: APIRoute = async ({request}) => {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string") {
    return jsonResponse({error: "A series name is required."}, {status: 400});
  }
  try {
    return jsonResponse(
      await createSeries(env.FEED_DB, {
        ...(typeof body.description === "string"
          ? {description: body.description}
          : {}),
        kind: parseKind(body.kind) ?? "post",
        name: body.name,
        ...(typeof body.slug === "string" ? {slug: body.slug} : {}),
      }),
      {status: 201},
    );
  } catch (error) {
    const response = serviceError(error);
    if (response) return response;
    throw error;
  }
};

export const getAdminSeries: APIRoute = async ({params}) => {
  const series = params.seriesId
    ? await getSeriesById(env.FEED_DB, params.seriesId)
    : null;
  return series
    ? jsonResponse(series)
    : jsonResponse({error: "Series not found."}, {status: 404});
};

export const updateAdminSeries: APIRoute = async ({params, request}) => {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !params.seriesId) {
    return jsonResponse({error: "Invalid series."}, {status: 400});
  }
  try {
    return jsonResponse(
      await updateSeries(env.FEED_DB, params.seriesId, {
        ...(typeof body.description === "string"
          ? {description: body.description}
          : {}),
        ...(parseKind(body.kind) ? {kind: parseKind(body.kind)} : {}),
        ...(typeof body.name === "string" ? {name: body.name} : {}),
        ...(typeof body.slug === "string" ? {slug: body.slug} : {}),
      }),
    );
  } catch (error) {
    const response = serviceError(error);
    if (response) return response;
    throw error;
  }
};

export const deleteAdminSeries: APIRoute = async ({params}) => {
  if (!params.seriesId) {
    return jsonResponse({error: "Invalid series."}, {status: 400});
  }
  await deleteSeries(env.FEED_DB, params.seriesId);
  return jsonResponse({});
};
