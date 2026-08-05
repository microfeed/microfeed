import type {APIRoute} from "astro";

import {apiItemInputSchema} from "@/shared/ApiSchemas";
import {createItem} from "@/server/items/service";
import {jsonResponse} from "../../../server/http";

export const POST: APIRoute = async ({locals, request}) => {
  if (!locals.feedCrud) {
    return new Response("Feed context unavailable", {status: 500});
  }
  const parsed = apiItemInputSchema.safeParse(await request.json().catch(
    () => null,
  ));
  if (!parsed.success) {
    return jsonResponse({error: "Invalid item."}, {status: 400});
  }
  const id = await createItem(locals.feedCrud, parsed.data);
  return jsonResponse({id}, {status: 201});
};
