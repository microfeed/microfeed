import FeedDb from "../../edge-src/models/FeedDb";
import FeedCrudManager from "../../edge-src/models/FeedCrudManager";
import { SETTINGS_CATEGORIES } from "../../common-src/Constants";
import mailChannelsPlugin from "@cloudflare/pages-plugin-mailchannels";

async function fetchFeedAndAuth({request, next, env, data}) {
  const feedDb = new FeedDb(env, request);
  const contentFromDb = await feedDb.getContent()

  const settings = contentFromDb.settings || {};
  const webGlobalSettings = settings.webGlobalSettings || {};
  const publicBucketUrl = webGlobalSettings.publicBucketUrl || '';

  data.publicBucketUrl = publicBucketUrl;
  data.feedDb = feedDb;
  data.feedContent = contentFromDb;
  data.feedCrud = new FeedCrudManager(contentFromDb, feedDb, request);

  if (contentFromDb.settings) {
    const apiSettings = contentFromDb.settings[SETTINGS_CATEGORIES.API_SETTINGS];
    if (apiSettings) {
      if (apiSettings.enabled) {
        const apiKey = request.headers.get('x-microfeedapi-key');
        try {
          const tokenMatched = apiSettings.apps.some(app => app.token === apiKey);
          if (apiKey && tokenMatched) {
            return next();
          }
        } catch(e) {} // eslint-disable-line no-empty
      }
    }
  }
  return new Response('Unauthorized', {status: 401});
}

function mailChannels(context) {
  return mailChannelsPlugin({
    personalizations: [
      {
        to: [{ name: "ACME Support", email: `${context.env.RECEIVER_EMAIL}` }],
      },
    ],
    from: {
      name: "Contact Us Form Inquiry",
      email: `${context.env.SENDER_EMAIL}`,
    },
    respondWith: () => {
      return new Response(
        `Thank you for submitting your inquiry. A member of the team will be in touch shortly.`
      );
    },
  })(context);
}

export const onRequest = [fetchFeedAndAuth, mailChannels];