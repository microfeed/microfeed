import {ADMIN_URLS} from "../../../common-src/StringUtils";

export async function onRequestGet({request}) {
  const urlObj = new URL(request.url);
  return Response.redirect(`${urlObj.origin}${ADMIN_URLS.allItems()}`, 302);
}
