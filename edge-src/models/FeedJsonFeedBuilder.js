import {PUBLIC_URLS} from "../../common-src/StringUtils";

const {MICROFEED_VERSION} = require('../../common-src/Version');

/**
 * FeedJsonFeedBuilder converts a plain schema object to JSON Feed format
 * JSON Feed spec: https://jsonfeed.org/version/1.1
 */
export default class FeedJsonFeedBuilder {
  constructor(schema, settings) {
    this.schema = schema;
    this.settings = settings || {};
    this.webGlobalSettings = this.settings.webGlobalSettings || {};
    this.publicBucketUrl = this.webGlobalSettings.publicBucketUrl || '';
  }

  _buildJsonFeedChannel() {
    const {channel, meta} = this.schema;
    const jsonFeedChannel = {
      title: channel.title,
      description: channel.description,
    };

    if (channel.link) {
      jsonFeedChannel.home_page_url = channel.link;
    }

    jsonFeedChannel.feed_url = PUBLIC_URLS.jsonFeed(meta.baseUrl);

    if (meta.itemsNextCursor && !meta.forOneItem) {
      jsonFeedChannel.next_url = `${jsonFeedChannel.feed_url}?next_cursor=${meta.itemsNextCursor}&sort=${meta.itemsSortOrder}`;
    }

    if (channel.image) {
      jsonFeedChannel.icon = channel.image;
    }

    if (this.webGlobalSettings.favicon && this.webGlobalSettings.favicon.url) {
      jsonFeedChannel.favicon = `${this.publicBucketUrl}${this.webGlobalSettings.favicon.url}`;
    }

    if (channel.publisher) {
      jsonFeedChannel.authors = [{
        name: channel.publisher,
      }];
    }

    if (channel.language) {
      jsonFeedChannel.language = channel.language;
    }

    if (channel.expired) {
      jsonFeedChannel.expired = true;
    }

    return jsonFeedChannel;
  }

  _buildJsonFeedMicrofeedExtra() {
    const {channel, meta} = this.schema;
    const subscribeMethods = this.settings.subscribeMethods || {methods: []};
    
    const microfeedExtra = {
      microfeed_version: MICROFEED_VERSION,
      base_url: meta.baseUrl,
      categories: [],
      subscribe_methods: [],
      description_text: channel.description,
      items_sort_order: meta.itemsSortOrder,
    };

    // Add categories (if any)
    const channelCategories = channel.categories || [];
    channelCategories.forEach((c) => {
      const topAndSubCats = c.split('/');
      let cat;
      if (topAndSubCats && topAndSubCats.length > 0) {
        cat = {
          name: topAndSubCats[0].trim(),
        };
        if (topAndSubCats.length > 1) {
          cat.categories = [{
            name: topAndSubCats[1].trim(),
          }];
        }
      }
      if (cat) {
        microfeedExtra.categories.push(cat);
      }
    });

    // Add subscribe methods
    if (subscribeMethods.methods && subscribeMethods.methods.length > 0) {
      microfeedExtra.subscribe_methods = subscribeMethods.methods
        .filter((m) => m.enabled)
        .map((m) => {
          const method = {...m};
          if (method.image) {
            method.image = `${this.publicBucketUrl}${method.image}`;
          }
          if (!method.editable) {
            switch (method.type) {
              case 'rss':
                method.url = PUBLIC_URLS.rssFeed(meta.baseUrl);
                break;
              case 'json':
                method.url = PUBLIC_URLS.jsonFeed(meta.baseUrl);
                break;
            }
          }
          return method;
        });
    }

    // Add cursor info
    if (meta.itemsNextCursor && !meta.forOneItem) {
      microfeedExtra.items_next_cursor = meta.itemsNextCursor;
      microfeedExtra.next_url = `${PUBLIC_URLS.jsonFeed(meta.baseUrl)}?next_cursor=${meta.itemsNextCursor}&sort=${meta.itemsSortOrder}`;
    }
    if (meta.itemsPrevCursor && !meta.forOneItem) {
      microfeedExtra.items_prev_cursor = meta.itemsPrevCursor;
      microfeedExtra.prev_url = `${PUBLIC_URLS.jsonFeed(meta.baseUrl)}?prev_cursor=${meta.itemsPrevCursor}&sort=${meta.itemsSortOrder}`;
    }

    return microfeedExtra;
  }

  _buildJsonFeedItem(item) {
    const jsonFeedItem = {
      id: item.id,
      title: item.title,
    };

    // Add new fields
    if (item.subtitle) {
      jsonFeedItem.subtitle = item.subtitle;
    }
    if (item.desc) {
      jsonFeedItem.desc = item.desc;
    }
    if (item.buttonText) {
      jsonFeedItem.buttonText = item.buttonText;
    }
    if (item.name) {
      jsonFeedItem.name = item.name;
    }
    if (typeof item.enabled === 'boolean') {
      jsonFeedItem.enabled = item.enabled;
    }
    if (item.custom_link) {
      jsonFeedItem.custom_link = item.custom_link;
    }

    // Add standard fields
    if (item.link) {
      jsonFeedItem.url = item.link;
    }
    if (item.externalUrl) {
      jsonFeedItem.external_url = item.externalUrl;
    }

    jsonFeedItem.content_html = item.description;
    jsonFeedItem.content_text = item.descriptionText;

    if (item.image) {
      jsonFeedItem.image = item.image;
    }
    if (item.bannerImage) {
      jsonFeedItem.banner_image = item.bannerImage;
    }

    if (item.pubDateRfc3339) {
      jsonFeedItem.date_published = item.pubDateRfc3339;
    }
    if (item.updatedDateRfc3339) {
      jsonFeedItem.date_modified = item.updatedDateRfc3339;
    }
    if (item.language) {
      jsonFeedItem.language = item.language;
    }

    // Add attachment
    if (item.attachment) {
      jsonFeedItem.attachments = [{
        url: item.attachment.url,
        mime_type: item.attachment.mimeType,
        size_in_byte: item.attachment.sizeByte,
        duration_in_seconds: item.attachment.durationSecond,
      }];
    }

    // Add microfeed metadata
    const _microfeed = {
      is_audio: item.mediaFile?.isAudio || false,
      is_document: item.mediaFile?.isDocument || false,
      is_external_url: item.mediaFile?.isExternalUrl || false,
      is_video: item.mediaFile?.isVideo || false,
      is_image: item.mediaFile?.isImage || false,
      web_url: item.webUrl,
      json_url: item.jsonUrl,
      rss_url: item.rssUrl,
      guid: item.guid,
      status: item.status,
      date_published_short: item.pubDate,
      date_published_ms: item.pubDateMs,
    };

    if (item.mediaFile?.durationHHMMSS) {
      _microfeed.duration_hhmmss = item.mediaFile.durationHHMMSS;
    }

    // Add iTunes metadata
    if (item.itunes.title) {
      _microfeed['itunes:title'] = item.itunes.title;
    }
    if (item.itunes.block) {
      _microfeed['itunes:block'] = item.itunes.block;
    }
    if (item.itunes.episodeType) {
      _microfeed['itunes:episodeType'] = item.itunes.episodeType;
    }
    if (item.itunes.season) {
      _microfeed['itunes:season'] = item.itunes.season;
    }
    if (item.itunes.episode) {
      _microfeed['itunes:episode'] = item.itunes.episode;
    }
    if (item.itunes.explicit) {
      _microfeed['itunes:explicit'] = item.itunes.explicit;
    }

    jsonFeedItem._microfeed = _microfeed;
    return jsonFeedItem;
  }

  getJsonFeed() {
    const jsonFeed = {
      version: 'https://jsonfeed.org/version/1.1',
      ...this._buildJsonFeedChannel(),
    };

    jsonFeed.items = this.schema.items.map(item => this._buildJsonFeedItem(item));
    jsonFeed._microfeed = this._buildJsonFeedMicrofeedExtra();

    return jsonFeed;
  }
}
