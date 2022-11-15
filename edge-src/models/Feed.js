import {projectPrefix} from "../../common-src/R2Utils";
import {buildAudioUrlWithTracking, PUBLIC_URLS} from "../../common-src/StringUtils";
import {ITEM_STATUSES} from "../../common-src/Constants";

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
      channel: {...content.channel},
      items: [],
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
    const existingitems = content.items || {};
    Object.keys(existingitems).forEach((itemId) => {
      const item = existingitems[itemId];
      if (item.status === ITEM_STATUSES.UNPUBLISHED) {
        return;
      }
      const mediaFile = item.mediaFile || {};
      const {url} = mediaFile;
      publicContent.items.push({
        ...item,
        id: itemId,
        title: item.title || 'Untitled',
        mediaFile: {
          ...item.mediaFile,
          url: buildAudioUrlWithTracking(url, trackingUrls),
        },
      });
    })
    publicContent.items.sort((a, b) => b.pubDateMs - a.pubDateMs);

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
