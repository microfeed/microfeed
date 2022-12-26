import {JsonResponseBuilder} from "../../edge-src/common/PageUtils";
import {STATUSES} from "../../common-src/Constants";

export async function onRequestGet({env, request}) {
  const jsonResponseBuilder = new JsonResponseBuilder(env, request, {
    queryKwargs: {
      status: STATUSES.PUBLISHED,
    },
  });
  return await jsonResponseBuilder.getResponse();
}
