export default class Feed {
  constructor(env) {
    const {LISTEN_HOST_VERSION, LH_DATABASE} = env;
    this.KEY = `database/${LISTEN_HOST_VERSION}-feed.json`;
    this.LH_DB = LH_DATABASE;

    this.content = null;
  }

  initFeed() {
    return {
      podcast: {
      },
      episodes: {
      },
    };
  }

  async getContent() {
    const res = await this.LH_DB.get(this.KEY);
    if (!res) {
      console.log('init');
      this.content = await this.putContent(this.initFeed());
    } else {
      this.content = await res.json();
    }
    return this.content;
  }

  async putContent(contentDict) {
    await this.LH_DB.put(this.KEY, JSON.stringify(contentDict), {
      'Content-Type': 'application/json; charset=UTF-8',
      });
    this.content = contentDict;
    return this.content;
  }

  async destroy() {
    await this.LH_DB.delete(this.KEY);
  }
}
