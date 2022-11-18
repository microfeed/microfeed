/**
 * XXX: d1 binding to env not working for now
 * https://github.com/cloudflare/wrangler2/issues/2168
 */
export default class FeedDb {
  constructor(env) {
    this.FEED_DB = env.FEED_DB;
  }
}
