import {projectPrefix} from "../../common-src/R2Utils";
import {buildAudioUrlWithTracking, PUBLIC_URLS} from "../../common-src/StringUtils";
import {ENCLOSURE_CATEGORIES, ITEM_STATUSES} from "../../common-src/Constants";
import {humanizeMs, msToRFC3339} from "../../common-src/TimeUtils";
import {convert} from "html-to-text";

const DEFAULT_MICROFEED_VERSION = 'v1';

export function decorateForItem(item) {
   item.webUrl = PUBLIC_URLS.itemWeb(item.id, item.title);
   item.pubDate = humanizeMs(item.pubDateMs);
   item.pubDateRfc3339 = msToRFC3339(item.pubDateMs);
   item.descriptionText = convert(item.description, {});

  if (item.mediaFile && item.mediaFile.category) {
    item.mediaFile.isAudio = item.mediaFile.category === ENCLOSURE_CATEGORIES.AUDIO;
    item.mediaFile.isDocument = item.mediaFile.category === ENCLOSURE_CATEGORIES.DOCUMENT;
    item.mediaFile.isExternalUrl = item.mediaFile.category === ENCLOSURE_CATEGORIES.EXTERNAL_URL;
    item.mediaFile.isVideo = item.mediaFile.category === ENCLOSURE_CATEGORIES.VIDEO;
    item.mediaFile.isImage = item.mediaFile.category === ENCLOSURE_CATEGORIES.IMAGE;
  }
}

class FeedPublicJsonBuilder {
  constructor(content, request) {
    this.content = content;
    this.request = request;
    this.settings = content.settings || {};
  }

  _buildPublicContentChannel() {
    const {channel} = this.content;
    const publicContent = {};
    publicContent['title'] = channel.title || 'untitled';

    if (channel.link) {
      publicContent['home_page_url'] = channel.link;
    }

    const urlObj = new URL(this.request.url);
    publicContent['feed_url'] = PUBLIC_URLS.feedJson(urlObj.origin);

    if (channel.description) {
      publicContent['description'] = channel.description;
    }

    if (channel.image) {
      publicContent['icon'] = channel.image;
    }

    if (channel.favicon) {
      publicContent['favicon'] = channel.favicon;
    }

    if (channel.publisher) {
      publicContent['authors'] = [{
        'name': channel.publisher,
      }];
    }

    if (channel.language) {
      publicContent['language'] = channel.language;
    }

    if (channel['itunes:complete']) {
      publicContent['expired'] = true;
    }
    return publicContent;
  }

  _buildPublicContentMicrofeedExtra() {
    const {channel} = this.content;
    const subscribeMethods = this.settings.subscribeMethods || {'methods': []};
    const microfeedExtra = {
      microfeed_version: this.content.microfeed_version || DEFAULT_MICROFEED_VERSION,
      subscribe_methods: subscribeMethods.methods.filter((m) => m.enabled).map((m) => {
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
      categories: channel.categories || [],
    };
    if (channel['itunes:explicit']) {
      microfeedExtra['itunes:explicit'] = true;
    }
    if (channel['itunes:title']) {
      microfeedExtra['itunes:title'] = channel['itunes:title'];
    }
    if (channel['copyright']) {
      microfeedExtra['copyright'] = channel['copyright'];
    }
    if (channel['itunes:title']) {
      microfeedExtra['itunes:title'] = channel['itunes:title'];
    }
    if (channel['itunes:type']) {
      microfeedExtra['itunes:type'] = channel['itunes:type'];
    }
    if (channel['itunes:block']) {
      microfeedExtra['itunes:block'] = channel['itunes:block'];
    }
    if (channel['itunes:complete']) {
      microfeedExtra['itunes:complete'] = channel['itunes:complete'];
    }
    if (channel['itunes:new-feed-url']) {
      microfeedExtra['itunes:new-feed-url'] = channel['itunes:new-feed-url'];
    }
    if (channel['itunes:email']) {
      microfeedExtra['itunes:email'] = channel['itunes:email'];
    }
    return microfeedExtra;
  }

  _buildPublicContentItem(itemId, item, mediaFile) {
    let trackingUrls = [];
    if (this.settings.analytics && this.settings.analytics.urls) {
      trackingUrls = this.settings.analytics.urls || [];
    }

    const newItem = {
      id: itemId,
      title: item.title || 'untitled',
    };
    const attachment = {};
    if (mediaFile.url) {
      attachment['url'] = buildAudioUrlWithTracking(mediaFile.url, trackingUrls);
    }
    if (mediaFile.contentType) {
      attachment['mime_type'] = mediaFile.contentType;
    }
    if (mediaFile.sizeByte) {
      attachment['size_in_byte'] = mediaFile.sizeByte;
    }
    if (mediaFile.durationSecond) {
      attachment['duration_in_seconds'] = mediaFile.durationSecond;
    }
    if (Object.keys(attachment).length > 0) {
      newItem['attachments'] = [attachment];
    }
    if (item.link) {
      newItem['url'] = item.link;
    }
    if (mediaFile.isExternalUrl && mediaFile.url) {
      newItem['external_url'] = mediaFile.url;
    }
    if (item.description) {
      newItem['content_html'] = item.description;
    }
    if (item.descriptionText) {
      newItem['content_text'] = item.descriptionText;
    }
    if (item.image) {
      newItem['item'] = item.image;
    }
    if (mediaFile.isImage && mediaFile.url) {
      newItem['banner_image'] = mediaFile.url;
    }
    if (item.pubDateMs) {
      newItem['date_published_ms'] = item.pubDateMs;
    }
    if (item.pubDateRfc3339) {
      newItem['date_published'] = item.pubDateRfc3339;
    }
    if (item.updatedDateRfc3339) {
      newItem['date_modified'] = item.updatedDateRfc3339;
    }
    if (item.language) {
      newItem['language'] = item.language;
    }
    return newItem;
  }

  getJsonData() {
    const publicContent = {
      version: 'https://jsonfeed.org/version/1.1',
      ...this._buildPublicContentChannel(this.content, this.request),
    };

    const {channel, items} = this.content;
    const existingitems = items || {};
    publicContent['items'] = [];
    Object.keys(existingitems).forEach((itemId) => {
      const item = existingitems[itemId];
      if (item.status === ITEM_STATUSES.UNPUBLISHED) {
        return;
      }
      decorateForItem(item);
      const mediaFile = item.mediaFile || {};
      const newItem = this._buildPublicContentItem(itemId, item, mediaFile);
      publicContent.items.push(newItem);
    })
    if (channel['itunes:type'] === 'episodic') {
      publicContent.items.sort((a, b) => b['date_published_ms'] - a['date_published_ms']);
    } else {
      publicContent.items.sort((a, b) => a['date_published_ms'] - b['date_published_ms']);
    }

    publicContent['_microfeed'] = this._buildPublicContentMicrofeedExtra();
    return publicContent;
  }
}

export default class Feed {
  constructor(env, request) {
    const {MICROFEED_VERSION, LH_DATABASE} = env;
    this.MICROFEED_VERSION = MICROFEED_VERSION || DEFAULT_MICROFEED_VERSION;
    this.KEY = `${projectPrefix(env)}/database/${this.MICROFEED_VERSION}-feed.json`;
    this.LH_DB = LH_DATABASE;
    this.content = null;
    this.request = request;
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

  async getPublicJsonData(content=null) {
    if (!content) {
      content = await this.getContent();
    }
    const builder = new FeedPublicJsonBuilder(content, this.request);
    return builder.getJsonData();
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
