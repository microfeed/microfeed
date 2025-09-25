import {
  urlJoinWithRelative,
  buildAudioUrlWithTracking,
  PUBLIC_URLS,
  secondsToHHMMSS,
  htmlToPlainText
} from "../../common-src/StringUtils";
import {humanizeMs, msToRFC3339} from "../../common-src/TimeUtils";
import {ENCLOSURE_CATEGORIES, ITEM_STATUSES_DICT, STATUSES} from "../../common-src/Constants";
import {isValidMediaFile} from "../../common-src/MediaFileUtils";

/**
 * FeedPublicSchemaBuilder creates a plain JSON schema object that can be consumed
 * by various format builders (JSON Feed, RSS, etc.)
 */
export default class FeedPublicSchemaBuilder {
  constructor(content, baseUrl, request, forOneItem = false) {
    this.content = content;
    this.settings = content.settings || {};
    this.webGlobalSettings = this.settings.webGlobalSettings || {};
    this.publicBucketUrl = this.webGlobalSettings.publicBucketUrl || '';
    this.baseUrl = baseUrl;
    this.forOneItem = forOneItem;
    this.request = request;
  }

  _decorateForItem(item, baseUrl) {
    item.webUrl = PUBLIC_URLS.webItem(item.id, item.title, baseUrl);
    item.jsonUrl = PUBLIC_URLS.jsonItem(item.id, null, baseUrl);
    item.rssUrl = PUBLIC_URLS.rssItem(item.id, null, baseUrl);

    // Try our best to use local time of a website visitor
    const timezone = this.request.cf ? this.request.cf.timezone : null;
    item.pubDate = humanizeMs(item.pubDateMs, timezone);
    item.pubDateRfc3339 = msToRFC3339(item.pubDateMs);
    item.descriptionText = htmlToPlainText(item.description);

    if (item.image) {
      item.image = urlJoinWithRelative(this.publicBucketUrl, item.image);
    }
    if (isValidMediaFile(item.mediaFile)) {
      item.mediaFile.isAudio = item.mediaFile.category === ENCLOSURE_CATEGORIES.AUDIO;
      item.mediaFile.isDocument = item.mediaFile.category === ENCLOSURE_CATEGORIES.DOCUMENT;
      item.mediaFile.isExternalUrl = item.mediaFile.category === ENCLOSURE_CATEGORIES.EXTERNAL_URL;
      item.mediaFile.isVideo = item.mediaFile.category === ENCLOSURE_CATEGORIES.VIDEO;
      item.mediaFile.isImage = item.mediaFile.category === ENCLOSURE_CATEGORIES.IMAGE;

      if (!item.mediaFile.isExternalUrl) {
        item.mediaFile.url = urlJoinWithRelative(this.publicBucketUrl, item.mediaFile.url);
      }
    }
  }

  _buildChannel() {
    const channel = this.content.channel || {};
    const publicChannel = {
      id: channel.id,
      title: channel.title || 'untitled',
      description: channel.description || '',
      link: channel.link,
      language: channel.language,
      publisher: channel.publisher,
      image: null,
      expired: channel['itunes:complete'] || false,
    };

    if (channel.image) {
      publicChannel.image = urlJoinWithRelative(this.publicBucketUrl, channel.image, this.baseUrl);
    }

    return publicChannel;
  }

  _buildItem(item, mediaFile) {
    let trackingUrls = [];
    if (this.settings.analytics && this.settings.analytics.urls) {
      trackingUrls = this.settings.analytics.urls || [];
    }

    const publicItem = {
      id: item.id,
      title: item.title || 'untitled',
      subtitle: item.subtitle || null,
      desc: item.desc || null,
      buttonText: item.buttonText || null,
      name: item.name || null,
      enabled: typeof item.enabled === 'boolean' ? item.enabled : null,
      custom_link: item.custom_link || null,
      description: item.description || '',
      descriptionText: item.descriptionText || '',
      link: item.link,
      image: item.image || null,
      pubDate: item.pubDate,
      pubDateRfc3339: item.pubDateRfc3339,
      pubDateMs: item.pubDateMs,
      updatedDateRfc3339: item.updatedDateRfc3339 || null,
      language: item.language || null,
      guid: item.guid,
      status: ITEM_STATUSES_DICT[item.status] ? ITEM_STATUSES_DICT[item.status].name : 'published',
      webUrl: item.webUrl,
      jsonUrl: item.jsonUrl,
      rssUrl: item.rssUrl,
      mediaFile: null,
      attachment: null,
      externalUrl: null,
      bannerImage: null,
      itunes: {
        title: item['itunes:title'] || null,
        block: item['itunes:block'] || false,
        episodeType: item['itunes:episodeType'] || null,
        season: item['itunes:season'] ? parseInt(item['itunes:season'], 10) : null,
        episode: item['itunes:episode'] ? parseInt(item['itunes:episode'], 10) : null,
        explicit: item['itunes:explicit'] || false,
      }
    };

    // Handle media file
    if (isValidMediaFile(mediaFile)) {
      publicItem.mediaFile = {
        url: mediaFile.url,
        contentType: mediaFile.contentType,
        sizeByte: mediaFile.sizeByte,
        durationSecond: mediaFile.durationSecond,
        durationHHMMSS: mediaFile.durationSecond ? secondsToHHMMSS(mediaFile.durationSecond) : null,
        isAudio: mediaFile.isAudio,
        isDocument: mediaFile.isDocument,
        isExternalUrl: mediaFile.isExternalUrl,
        isVideo: mediaFile.isVideo,
        isImage: mediaFile.isImage,
      };

      // Create attachment for JSON Feed compatibility
      if (mediaFile.url) {
        publicItem.attachment = {
          url: buildAudioUrlWithTracking(mediaFile.url, trackingUrls),
          mimeType: mediaFile.contentType,
          sizeByte: mediaFile.sizeByte,
          durationSecond: mediaFile.durationSecond,
        };
      }

      // Handle special cases
      if (mediaFile.isExternalUrl && mediaFile.url) {
        publicItem.externalUrl = mediaFile.url;
      }
      if (mediaFile.isImage && mediaFile.url) {
        publicItem.bannerImage = mediaFile.url;
      }
    }

    return publicItem;
  }

  getSchema() {
    const schema = {
      channel: this._buildChannel(),
      items: [],
      meta: {
        baseUrl: this.baseUrl,
        forOneItem: this.forOneItem,
        itemsSortOrder: this.content.items_sort_order,
        itemsNextCursor: this.content.items_next_cursor || null,
        itemsPrevCursor: this.content.items_prev_cursor || null,
      }
    };

    const {items} = this.content;
    const existingItems = items || [];
    
    existingItems.forEach((item) => {
      if (![STATUSES.PUBLISHED, STATUSES.UNLISTED].includes(item.status)) {
        return;
      }
      this._decorateForItem(item, this.baseUrl);
      const mediaFile = item.mediaFile || {};
      const publicItem = this._buildItem(item, mediaFile);
      schema.items.push(publicItem);
    });

    return schema;
  }
}
