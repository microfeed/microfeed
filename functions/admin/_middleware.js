import {ADMIN_URLS, urlJoin} from "../../common-src/StringUtils";
import FeedDb, {getFetchItemsParams} from "../../edge-src/models/FeedDb";
import ContentService from "../../edge-src/models/ContentService";
import {createMediaStore} from "../../edge-src/models/MediaStore";
import OnboardingChecker from "../../common-src/OnboardingUtils";
import {STATUSES} from "../../common-src/Constants";

async function fetchFeed({request, next, env, data}) {
  const urlObj = new URL(request.url);

  if (urlObj.pathname.startsWith(urlJoin(ADMIN_URLS.home(), '/ajax/'))) {
    const ajaxFeedDb = new FeedDb(env, request);
    const ajaxContentFromDb = await ajaxFeedDb.getContent();

    data.feedDb = ajaxFeedDb;
    data.feedContent = ajaxContentFromDb;
    data.feedCrud = new ContentService(ajaxContentFromDb, ajaxFeedDb, request, createMediaStore(env));

    return next();
  }

  let fetchItems = null;
  if (urlObj.pathname.startsWith(urlJoin(ADMIN_URLS.home(), '/feed/json')) ||
      urlObj.pathname.startsWith(urlJoin(ADMIN_URLS.home(), '/items/list'))) {
    fetchItems = getFetchItemsParams(request, {
      'status__!=': STATUSES.DELETED,
    });
  } else if (urlObj.pathname.startsWith(urlJoin(ADMIN_URLS.home(), '/items/'))) {
    // Either /items/ or /items/{id}
    if (!urlObj.pathname.startsWith(urlJoin(ADMIN_URLS.home(), '/items/new'))) {
      return next();
    }
  }

  const feedDb = new FeedDb(env, request);
  const contentFromDb = await feedDb.getContent(fetchItems)

  const onboardingChecker = new OnboardingChecker(contentFromDb, request, env);
  const onboardingResult = onboardingChecker.getResult();

  data.feedDb = feedDb;
  data.feedContent = contentFromDb;
  data.onboardingResult = onboardingResult;
  data.feedCrud = new ContentService(contentFromDb, feedDb, request, createMediaStore(env));

  return next();
}

export const onRequest = [fetchFeed];
