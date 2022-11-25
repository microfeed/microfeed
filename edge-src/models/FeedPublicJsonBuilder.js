import {buildAudioUrlWithTracking, PUBLIC_URLS} from "../../common-src/StringUtils";
import {humanizeMs, msToRFC3339} from "../../common-src/TimeUtils";
import {convert} from "html-to-text";
import {ENCLOSURE_CATEGORIES, STATUSES} from "../../common-src/Constants";

const DEFAULT_MICROFEED_VERSION = 'v1';

export default class FeedPublicJsonBuilder {
  constructor(content, baseUrl) {
    this.content = content;
    this.settings = content.settings || {};
    this.webGlobalSettings = this.settings.webGlobalSettings || {};
    this.publicBucketUrl = this.webGlobalSettings.publicBucketUrl || '';
    this.baseUrl = baseUrl;
  }

  _decorateForItem(item, baseUrl) {
    item.webUrl = PUBLIC_URLS.webItem(item.id, item.title, baseUrl);
    item.pubDate = humanizeMs(item.pubDateMs);
    item.pubDateRfc3339 = msToRFC3339(item.pubDateMs);
    item.descriptionText = convert(item.description, {});

    if (item.image) {
      item.image = `${this.publicBucketUrl}/${item.image}`;
    }
    if (item.mediaFile && item.mediaFile.category) {
      item.mediaFile.isAudio = item.mediaFile.category === ENCLOSURE_CATEGORIES.AUDIO;
      item.mediaFile.isDocument = item.mediaFile.category === ENCLOSURE_CATEGORIES.DOCUMENT;
      item.mediaFile.isExternalUrl = item.mediaFile.category === ENCLOSURE_CATEGORIES.EXTERNAL_URL;
      item.mediaFile.isVideo = item.mediaFile.category === ENCLOSURE_CATEGORIES.VIDEO;
      item.mediaFile.isImage = item.mediaFile.category === ENCLOSURE_CATEGORIES.IMAGE;

      if (!item.mediaFile.isExternalUrl) {
        item.mediaFile.url = `${this.publicBucketUrl}/${item.mediaFile.url}`;
      }
    }
  }

  _buildPublicContentChannel() {
    const channel = this.content.channel || {};
    const publicContent = {};
    publicContent['title'] = channel.title || 'untitled';

    if (channel.link) {
      publicContent['home_page_url'] = channel.link;
    }

    publicContent['feed_url'] = PUBLIC_URLS.jsonFeed(this.baseUrl);

    if (this.content.items_next_cursor) {
      publicContent['next_url'] = `${publicContent['feed_url']}?next_cursor=${this.content.items_next_cursor}&` +
        `sort=${this.content.items_sort_order}`;
    }

    if (channel.description) {
      publicContent['description'] = channel.description;
    }

    if (channel.image) {
      publicContent['icon'] = channel.image.startsWith('/') ? channel.image : `${this.publicBucketUrl}/${channel.image}`;
    }

    if (this.webGlobalSettings.favicon && this.webGlobalSettings.favicon.url) {
        publicContent['favicon'] = this.webGlobalSettings.favicon.url.startsWith('/') ?
          this.webGlobalSettings.favicon.url : `${this.publicBucketUrl}/${this.webGlobalSettings.favicon.url}`;
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

  _buildPublicContentMicrofeedExtra(publicContent) {
    const channel = this.content.channel || {};
    const subscribeMethods = this.settings.subscribeMethods || {'methods': []};
    const microfeedExtra = {
      microfeed_version: this.content.microfeed_version || DEFAULT_MICROFEED_VERSION,
      categories: [],
    };
    const channelCategories = channel.categories || [];
    channelCategories.forEach((c) => {
      const topAndSubCats = c.split('/');
      let cat;
      if (topAndSubCats) {
        if (topAndSubCats.length > 0) {
          cat = {
            'name': topAndSubCats[0].trim(),
          };
        }
        if (topAndSubCats.length > 1) {
          cat['categories'] = [{
            'name': topAndSubCats[1].trim(),
          }]
        }
      }
      if (cat) {
        microfeedExtra['categories'].push(cat);
      }
    });
    if (!subscribeMethods.methods) {
      microfeedExtra['subscribe_methods'] = '';
    } else {
      microfeedExtra['subscribe_methods'] = subscribeMethods.methods.filter((m) => m.enabled).map((m) => {
        if (!m.editable) {
          switch (m.type) {
            case 'rss':
              m.url = PUBLIC_URLS.rssFeed();
              return m;
            case 'json':
              m.url = PUBLIC_URLS.jsonFeed();
              return m;
            default:
              return m;
          }
        }
        return m;
      });
    }
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
    microfeedExtra['items_sort_order'] = this.content.items_sort_order;
    if (this.content.items_next_cursor) {
      microfeedExtra['items_next_cursor'] = this.content.items_next_cursor;
      microfeedExtra['next_url'] = publicContent['next_url'];
    }
    if (this.content.items_prev_cursor) {
      microfeedExtra['items_prev_cursor'] = this.content.items_prev_cursor;
      microfeedExtra['prev_url'] = `${publicContent['feed_url']}?prev_cursor=${this.content.items_prev_cursor}&` +
        `sort=${this.content.items_sort_order}`;
    }
    return microfeedExtra;
  }

  _buildPublicContentItem(item, mediaFile) {
    let trackingUrls = [];
    if (this.settings.analytics && this.settings.analytics.urls) {
      trackingUrls = this.settings.analytics.urls || [];
    }

    const newItem = {
      id: item.id,
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
      newItem['image'] = item.image;
    }
    if (mediaFile.isImage && mediaFile.url) {
      newItem['banner_image'] = mediaFile.url;
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

    const _microfeed = {
      is_audio: mediaFile.isAudio,
      is_document: mediaFile.isDocument,
      is_external_url: mediaFile.isExternalUrl,
      is_video: mediaFile.isVideo,
      is_image: mediaFile.isImage,
      web_url: item.webUrl,
    };
    if (item['itunes:title']) {
      _microfeed['itunes:title'] = item['itunes:title'];
    }
    if (item['itunes:block']) {
      _microfeed['itunes:block'] = item['itunes:block'];
    }
    if (item['itunes:episodeType']) {
      _microfeed['itunes:episodeType'] = item['itunes:episodeType'];
    }
    if (item['itunes:season']) {
      _microfeed['itunes:season'] = item['itunes:season'];
    }
    if (item['itunes:episode']) {
      _microfeed['itunes:episode'] = item['itunes:episode'];
    }
    if (item['itunes:explicit']) {
      _microfeed['itunes:explicit'] = item['itunes:explicit'];
    }
    if (item.pubDate) {
      _microfeed['date_published_short'] = item.pubDate;
    }
    if (item.pubDateMs) {
      _microfeed['date_published_ms'] = item.pubDateMs;
    }

    newItem['_microfeed'] = _microfeed;
    return newItem;
  }

  getJsonData() {
    const publicContent = {
      version: 'https://jsonfeed.org/version/1.1',
      ...this._buildPublicContentChannel(this.content),
    };

    const {items} = this.content;
    const existingitems = items || [];
    publicContent['items'] = [];
    existingitems.forEach((item) => {
      if (item.status === STATUSES.UNPUBLISHED) {
        return;
      }
      this._decorateForItem(item, this.baseUrl);
      const mediaFile = item.mediaFile || {};
      const newItem = this._buildPublicContentItem(item, mediaFile);
      publicContent.items.push(newItem);
    })

    // Note: We don't proactively sort items based on itunes:type.
    //       Instead, we rely on ?sort= query param and settings
    // if (channel['itunes:type'] === 'episodic') {
    //   publicContent.items.sort((a, b) => b['_microfeed']['date_published_ms'] - a['_microfeed']['date_published_ms']);
    // } else {
    //   publicContent.items.sort((a, b) => a['_microfeed']['date_published_ms'] - b['_microfeed']['date_published_ms']);
    // }

    publicContent['_microfeed'] = this._buildPublicContentMicrofeedExtra(publicContent);
    return publicContent;
  }
}
