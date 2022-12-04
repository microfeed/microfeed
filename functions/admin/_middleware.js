import {ADMIN_URLS, urlJoin} from "../../common-src/StringUtils";
import FeedDb, {getFetchItemsParams} from "../../edge-src/models/FeedDb";
import OnboardingChecker from "../../common-src/OnboardingUtils";
import {STATUSES} from "../../common-src/Constants";

async function fetchFeed({request, next, env, data}) {
  const urlObj = new URL(request.url);

  if (urlObj.pathname.startsWith(urlJoin(ADMIN_URLS.home(), '/ajax/'))) {
    return next();
  }

  let fetchItems = null;
  if (urlObj.pathname.startsWith(urlJoin(ADMIN_URLS.home(), '/feed/json'))) {
    fetchItems = getFetchItemsParams(request, {
      'status__!=': STATUSES.DELETED,
    });
  }
  const feedDb = new FeedDb(env, request);
  const contentFromDb = await feedDb.getContent(fetchItems)

  const onboardingChecker = new OnboardingChecker(contentFromDb, request, env);
  const onboardingResult = onboardingChecker.getResult()

  data.feedContent = contentFromDb;
  data.onboardingResult = onboardingResult;

  return next();
}

export const onRequest = [fetchFeed];
