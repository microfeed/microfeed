import {randomShortUUID, removeHostFromUrl} from "../../common-src/StringUtils";

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

    if (item.attachment) {
      const mediaFile = {};
      if (item.attachment.url) {
        // Media file url for internal schema doesn't have host:
        // [pages-project-name]/[environment]/media/[file-type]-[uuid].[extension]
        mediaFile.url = removeHostFromUrl(item.attachment.url);
      }
      if (item.attachment.category) {
        mediaFile.category = item.attachment.category;
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

    if ('itunes:title' in item) {
      internalSchema['itunes:title'] = item['itunes:title'];
    }

    if (typeof item['itunes:block'] === 'boolean') {
      internalSchema['itunes:block'] = item['itunes:block'];
    }

    if (['full', 'trailer', 'bonus'].includes(item['itunes:episodeType'])) {
      internalSchema['itunes:episodeType'] = item['itunes:episodeType'];
    }

    if (item ['itunes:season']) {
      internalSchema['itunes:season'] = item['itunes:season'];
    }

    if (item['itunes:episode']) {
      internalSchema['itunes:episode'] = item['itunes:episode'];
    }

    if (typeof item['itunes:explicit'] === 'boolean') {
      internalSchema['itunes:explicit'] = item['itunes:explicit'];
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
}
