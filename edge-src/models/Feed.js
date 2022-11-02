import {projectPrefix} from "../../common-src/R2Utils";

export default class Feed {
  constructor(env) {
    const {LISTEN_HOST_VERSION, LH_DATABASE} = env;
    this.KEY = `${projectPrefix(env)}/database/${LISTEN_HOST_VERSION}-feed.json`;
    this.LH_DB = LH_DATABASE;
    this.LISTEN_HOST_VERSION = LISTEN_HOST_VERSION;
    this.content = null;
  }

  initFeed() {
    return {
      version: this.LISTEN_HOST_VERSION,
    };
  }

  async getContent() {
    const res = await this.LH_DB.get(this.KEY);
    if (!res) {
      this.content = await this.putContent(this.initFeed());
    } else {
      this.content = await res.json();
    }
    return this.content;
  }

  async getContentPublic() {
    const content = await this.getContent();
    const publicContent = {
      version: content.version,
      podcast: {...content.podcast},
      episodes: [],
    };
    // const settings = content.settings || {};
    // const {trackingUrls} = settings;
    const existingEpisodes = content.episodes || {};
    Object.keys(existingEpisodes).forEach((episodeId) => {
      const eps = existingEpisodes[episodeId];
      publicContent.episodes.push({
        ...eps,
        id: episodeId,
      });
    })
    publicContent.episodes.sort((a, b) => b.pubDateMs - a.pubDateMs);
    return publicContent;
  }

  async putContent(contentDict) {
    contentDict.version = this.LISTEN_HOST_VERSION;
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
