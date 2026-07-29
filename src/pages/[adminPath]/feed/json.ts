import type {APIRoute} from "astro";

import {jsonResponse} from "../../../server/http";

export const GET: APIRoute = ({locals}) => {
  if (!locals.feedContent) {
    return new Response("Feed context unavailable", {status: 500});
  }
  return jsonResponse(locals.feedContent);
};
