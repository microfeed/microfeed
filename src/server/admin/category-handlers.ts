import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "@/server/http";
import {
  CategoryConflictError,
  CategoryRequestError,
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  updateCategory,
} from "@/server/categories/service";

function serviceError(error: unknown): Response | undefined {
  if (error instanceof CategoryRequestError) {
    return jsonResponse({error: error.message}, {status: 400});
  }
  if (error instanceof CategoryConflictError) {
    return jsonResponse({error: error.message}, {status: 409});
  }
  return undefined;
}

export const listAdminCategories: APIRoute = async () =>
  jsonResponse({items: await listCategories(env.FEED_DB)});

export const createAdminCategory: APIRoute = async ({request}) => {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string") {
    return jsonResponse({error: "A category name is required."}, {status: 400});
  }
  try {
    return jsonResponse(
      await createCategory(env.FEED_DB, {
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

export const getAdminCategory: APIRoute = async ({params}) => {
  const category = params.categoryId
    ? await getCategoryById(env.FEED_DB, params.categoryId)
    : null;
  return category
    ? jsonResponse(category)
    : jsonResponse({error: "Category not found."}, {status: 404});
};

export const updateAdminCategory: APIRoute = async ({params, request}) => {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !params.categoryId) {
    return jsonResponse({error: "Invalid category."}, {status: 400});
  }
  try {
    return jsonResponse(
      await updateCategory(env.FEED_DB, params.categoryId, {
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

export const deleteAdminCategory: APIRoute = async ({params}) => {
  if (!params.categoryId) {
    return jsonResponse({error: "Invalid category."}, {status: 400});
  }
  await deleteCategory(env.FEED_DB, params.categoryId);
  return jsonResponse({});
};
