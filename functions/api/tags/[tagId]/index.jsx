import {getIdFromSlug} from "../../../../common-src/StringUtils";
import TagService from "../../../../edge-src/models/TagService";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    status,
  });
}

function isNotFoundError(result) {
  return result?.errors?.some((error) => error.field === 'id');
}

export async function onRequestPut({ params, request, env }) {
  const {tagId} = params;
  const tagUniqId = getIdFromSlug(tagId) || tagId;

  const body = await request.json();
  const tagService = new TagService(env.FEED_DB);
  const result = await tagService.rename(tagUniqId, body || {});

  if (result && result.errors) {
    const status = isNotFoundError(result) ? 404 : 400;
    return jsonResponse({ errors: result.errors }, status);
  }

  return jsonResponse({ tag: result }, 200);
}

export async function onRequestDelete({ params, env }) {
  const {tagId} = params;
  const tagUniqId = getIdFromSlug(tagId) || tagId;

  const tagService = new TagService(env.FEED_DB);
  const result = await tagService.delete(tagUniqId);

  if (result && result.errors) {
    const status = isNotFoundError(result) ? 404 : 400;
    return jsonResponse({ errors: result.errors }, status);
  }

  return jsonResponse({ id: result.id }, 200);
}
