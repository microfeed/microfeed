import {JsonResponseBuilder} from "../../edge-src/common/PageUtils";

export async function onRequestGet({env, request}) {
  const jsonResponseBuilder = new JsonResponseBuilder(env, request);
  return await jsonResponseBuilder.getResponse();
}
