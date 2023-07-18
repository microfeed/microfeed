import {
  randomShortUUID,
  removeHostFromUrl
} from "../../common-src/StringUtils";
import {
  ENCLOSURE_CATEGORIES,
  ENCLOSURE_CATEGORIES_DICT,
  LANGUAGE_CODES_LIST
} from "../../common-src/Constants";

const LANGUAGE_CODES = LANGUAGE_CODES_LIST.map((lc) => lc.code);

export default class FeedCrudManager {
  constructor(feedContent, feedDb, request) {
    this.feedContent = feedContent;
    this.feedDb = feedDb;
    this.request = request;
  }

  _publicToInternalSchemaForItem(item) {
    const internalSchema = {};

    if (item.title) {
      internalSchema.title = item.title;
    }

    if (item.status) {
      internalSchema.status = item.status;
    }

    if (item.attachment &&
      ENCLOSURE_CATEGORIES_DICT[item.attachment.category] &&
      item.attachment.url) {
      const mediaFile = {};
      if (item.attachment.category) {
        mediaFile.category = item.attachment.category;
      }
      if (item.attachment.url) {
        // Media file url for internal schema doesn't have host:
        // [pages-project-name]/[environment]/media/[file-type]-[uuid].[extension]
        mediaFile.url = item.attachment.category !== ENCLOSURE_CATEGORIES.EXTERNAL_URL ?
          removeHostFromUrl(item.attachment.url) : item.attachment.url;
      }
      if (item.attachment.mime_type) {
        mediaFile.contentType = item.attachment.mime_type;
      }
      if (item.attachment.size_in_bytes) {
        mediaFile.sizeByte = item.attachment.size_in_bytes;
      }
      if (item.attachment.duration_in_seconds) {
        mediaFile.durationSecond = item.attachment.duration_in_seconds;
      }
      internalSchema.mediaFile = mediaFile;
    }

    if (item.url) {
      internalSchema.link = item.url;
    }

    if (item.content_html) {
      internalSchema.description = item.content_html;
    }

    if (item.image) {
      // Media file url for internal schema doesn't have host:
      // [pages-project-name]/[environment]/media/[file-type]-[uuid].[extension]
      internalSchema.image = removeHostFromUrl(item.image);
    }

    if (item.date_published_ms) {
      internalSchema.pubDateMs = item.date_published_ms;
    }

    if (!item._microfeed) {
      item._microfeed = {};
    }

    if ('itunes:title' in item._microfeed) {
      internalSchema['itunes:title'] = item._microfeed['itunes:title'];
    }

    if (typeof item._microfeed['itunes:block'] === 'boolean') {
      internalSchema['itunes:block'] = item._microfeed['itunes:block'];
    }

    if (['full', 'trailer', 'bonus'].includes(item._microfeed['itunes:episodeType'])) {
      internalSchema['itunes:episodeType'] = item._microfeed['itunes:episodeType'];
    }

    if (item._microfeed['itunes:season']) {
      internalSchema['itunes:season'] = item._microfeed['itunes:season'];
    }

    if (item._microfeed['itunes:episode']) {
      internalSchema['itunes:episode'] = item._microfeed['itunes:episode'];
    }

    if (typeof item._microfeed['itunes:explicit'] === 'boolean') {
      internalSchema['itunes:explicit'] = item._microfeed['itunes:explicit'];
    }

    if (!item.tags) {
      item.tags = [];
    }

    return internalSchema;
  }

  _publicToInternalSchemaForChannel(channel) {
    const internalSchema = {};
    if (channel.title) {
      internalSchema.title = channel.title;
    }
    if (channel.home_page_url) {
      internalSchema.link = channel.home_page_url;
    }
    if (channel.description) {
      internalSchema.description = channel.description;
    }
    if (channel.icon) {
      internalSchema.image = removeHostFromUrl(channel.icon);
    }
    if (channel.authors && channel.authors.length > 0 && channel.authors[0].name) {
      internalSchema.publisher = channel.authors[0].name;
    }
    if (LANGUAGE_CODES.includes(channel.language)) {
      internalSchema.language = channel.language;
    }
    if (typeof channel.expired === 'boolean') {
      internalSchema['itunes:complete'] = channel.expired;
    }
    if (!channel._microfeed) {
      channel._microfeed = {};
    }
    if (typeof channel._microfeed['itunes:explicit'] === 'boolean') {
      internalSchema['itunes:explicit'] = channel._microfeed['itunes:explicit'];
    }
    if (channel._microfeed['itunes:title']) {
      internalSchema['itunes:title'] = channel._microfeed['itunes:title'];
    }
    if (typeof channel._microfeed['itunes:block'] === 'boolean') {
      internalSchema['itunes:block'] = channel._microfeed['itunes:block'];
    }
    if (['episodic', 'serial'].includes(channel._microfeed['itunes:type'])) {
      internalSchema['itunes:type'] = channel._microfeed['itunes:type'];
    }
    if (channel._microfeed['copyright']) {
      internalSchema['copyright'] = channel._microfeed['copyright'];
    }
    if (channel._microfeed['itunes:email']) {
      internalSchema['itunes:email'] = channel._microfeed['itunes:email'];
    }

    if (channel.tags) {
      internalSchema.tags = channel.tags;
    }

    return internalSchema;
  }

  upsertItem(item) {
    const itemId = item.id ? item.id : randomShortUUID();
    const guid = item.guid ? item.guid : itemId;
    this.feedContent.item = {
      ...this._publicToInternalSchemaForItem(item),
      id: itemId,
      guid,
    };
    this.feedDb.putContent(this.feedContent);
    return itemId;
  }

  /**
   * Assume it's primary channel for now
   * @param channel {Object}
   */
  upsertChannel(channel) {
    this.feedContent.channel = {
      ...this.feedContent.channel,
      ...this._publicToInternalSchemaForChannel(channel),
    };
    this.feedDb.putContent(this.feedContent);
    return this.feedContent.id;
  }
}
