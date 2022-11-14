import {projectPrefix} from "../../common-src/R2Utils";
import {buildAudioUrlWithTracking, PUBLIC_URLS} from "../../common-src/StringUtils";

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

  async getContentPublic(content=null) {
    if (!content) {
      content = await this.getContent();
    }
    const publicContent = {
      version: content.version,
      podcast: {...content.podcast},
      episodes: [],
      subscribeMethods: content.settings.subscribeMethods.methods.filter((m) => m.enabled).map((m) => {
        if (!m.editable) {
          switch (m.type) {
            case 'rss':
              m.url = PUBLIC_URLS.feedRss();
              return m;
            case 'json':
              m.url = PUBLIC_URLS.feedJson();
              return m;
            default:
              return m;
          }
        }
        return m;
      }),
    };
    const settings = content.settings || {};
    let trackingUrls = [];
    if (settings.analytics && settings.analytics.urls) {
      trackingUrls = settings.analytics.urls || [];
    }
    const existingEpisodes = content.episodes || {};
    Object.keys(existingEpisodes).forEach((episodeId) => {
      const eps = existingEpisodes[episodeId];
      const mediaFile = eps.mediaFile || {};
      const {url} = mediaFile;
      publicContent.episodes.push({
        ...eps,
        id: episodeId,
        title: eps.title || 'Untitled',
        mediaFile: {
          ...eps.mediaFile,
          url: buildAudioUrlWithTracking(url, trackingUrls),
        },
      });
    })
    publicContent.episodes.sort((a, b) => b.pubDateMs - a.pubDateMs);

    return publicContent;
  }

  async getSettings(content=null) {
    if (!content) {
      content = await this.getContent();
    }
    return content.settings;
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
