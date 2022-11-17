import {JsonResponseBuilder} from "../../edge-src/common/PageUtils";

export async function onRequestGet({env}) {
  const jsonResponseBuilder = new JsonResponseBuilder(env);
  return await jsonResponseBuilder.getResponse();
}
