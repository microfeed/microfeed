/**
 * Episode schema:
 *  Newest first
 *    eps:asc:{numeric-id}
 *  Oldest first
 *    eps:desc:1/{numeric-id}
 */
export default class Episode {
  constructor(env) {
    const {LISTEN_HOST_VERSION, LH_DB} = env;
    this.KEY_PREFIX = `${LISTEN_HOST_VERSION}:eps`;
    this.LH_DB = LH_DB;
    this.currentValueDict = null;
  }
}
