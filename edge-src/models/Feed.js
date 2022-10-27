export default class Feed {
  constructor(env) {
    const {LISTEN_HOST_VERSION, LH_DATABASE} = env;
    this.KEY = `database/${LISTEN_HOST_VERSION}-feed.json`;
    this.LH_DB = LH_DATABASE;

    this.content = null;
  }

  async getContent() {
    this.content = await this.LH_DB.get(this.KEY);
    return this.content;
  }

  async putContent(contentDict) {
    await this.LH_DB.put(this.KEY, JSON.stringify(contentDict));
    this.content = contentDict;
    return this.content;
  }
}
