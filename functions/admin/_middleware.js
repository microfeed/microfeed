import {ADMIN_URLS, urlJoin} from "../../common-src/StringUtils";

function fetchFeed({request, next}) {
  const urlObj = new URL(request.url);

  if (urlObj.pathname.startsWith(urlJoin(ADMIN_URLS.home(), '/ajax/'))) {
    return next();
  }

  return next();
}

export const onRequest = [fetchFeed];
