import {projectPrefix} from "../../common-src/R2Utils";
import {buildAudioUrlWithTracking, PUBLIC_URLS} from "../../common-src/StringUtils";
import {ENCLOSURE_CATEGORIES, ITEM_STATUSES} from "../../common-src/Constants";
import {humanizeMs} from "../common/TimeUtils";
import {convert} from "html-to-text";

const DEFAULT_MICROFEED_VERSION = 'v1';

export function decorateForItem(item) {
   item.webUrl = PUBLIC_URLS.itemWeb(item.id, item.title);
   item.pubDate = humanizeMs(item.pubDateMs);
   item.descriptionText = convert(item.description, {});

  if (item.mediaFile && item.mediaFile.category) {
    item.mediaFile.isAudio = item.mediaFile.category === ENCLOSURE_CATEGORIES.AUDIO;
    item.mediaFile.isDocument = item.mediaFile.category === ENCLOSURE_CATEGORIES.DOCUMENT;
    item.mediaFile.isExternalUrl = item.mediaFile.category === ENCLOSURE_CATEGORIES.EXTERNAL_URL;
    item.mediaFile.isVideo = item.mediaFile.category === ENCLOSURE_CATEGORIES.VIDEO;
    item.mediaFile.isImage = item.mediaFile.category === ENCLOSURE_CATEGORIES.IMAGE;
  }
}

export default class Feed {
  constructor(env) {
    const {MICROFEED_VERSION, LH_DATABASE} = env;
    this.MICROFEED_VERSION = MICROFEED_VERSION || DEFAULT_MICROFEED_VERSION;
    this.KEY = `${projectPrefix(env)}/database/${this.MICROFEED_VERSION}-feed.json`;
    this.LH_DB = LH_DATABASE;
    this.content = null;
  }

  initFeed() {
    return {
      version: this.MICROFEED_VERSION,
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
    const settings = content.settings || {};
    const subscribeMethods = settings.subscribeMethods || {'methods': []};
    const publicContent = {
      version: content.microfeed_version || DEFAULT_MICROFEED_VERSION,
      channel: {...content.channel},
      items: [],
      subscribeMethods: subscribeMethods.methods.filter((m) => m.enabled).map((m) => {
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
      decorateForItem(item);
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
    if (content.channel['itunes:type'] === 'episodic') {
      publicContent.items.sort((a, b) => b.pubDateMs - a.pubDateMs);
    } else {
      publicContent.items.sort((a, b) => a.pubDateMs - b.pubDateMs);
    }

    return publicContent;
  }

  async getSettings(content=null) {
    if (!content) {
      content = await this.getContent();
    }
    return content.settings;
  }

  async putContent(contentDict) {
    contentDict.microfeed_version = this.MICROFEED_VERSION;
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
