import {JsonResponseBuilder} from "../../edge-src/common/PublicPageUtils";

export async function onRequestGet({env}) {
  const jsonResponseBuilder = new JsonResponseBuilder(env);
  return await jsonResponseBuilder.getResponse();
}
