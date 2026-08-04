import {
  urlJoinWithRelative,
  buildAudioUrlWithTracking,
  PUBLIC_URLS,
  resolvePublicBucketUrl,
  secondsToHHMMSS,
  htmlToPlainText
} from "@/shared/StringUtils";
import {humanizeMs, msToRFC3339} from "@/shared/TimeUtils";
import {ENCLOSURE_CATEGORIES, ITEM_STATUSES_DICT, STATUSES} from "@/shared/Constants";
import {isValidMediaFile} from "@/shared/MediaFileUtils";
import {MICROFEED_VERSION} from "@/shared/Version";
import {buildItemPaginationUrl} from "@/shared/ItemPagination";

export default class FeedPublicJsonBuilder {
  [member: string]: any;

  constructor(content: any, baseUrl: any, request: any, forOneItem: any = false) {
    this.content = content;
    this.settings = content.settings || {};
    this.webGlobalSettings = this.settings.webGlobalSettings || {};
    this.publicBucketUrl = resolvePublicBucketUrl(
      this.webGlobalSettings.publicBucketUrl,
      new URL(request.url).hostname,
    );
    this.baseUrl = baseUrl;
    this.forOneItem = forOneItem;
    this.request = request;
  }

  _decorateForItem(item: any, baseUrl: any) {
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

  _buildPublicContentChannel() {
    const channel = this.content.channel || {};
    const publicContent = {};
    (publicContent as any)['title'] = channel.title || 'untitled';

    if (channel.link) {
      (publicContent as any)['home_page_url'] = channel.link;
    }

    (publicContent as any)['feed_url'] = PUBLIC_URLS.jsonFeed(this.baseUrl);

    if (this.content.items_next_cursor !== undefined && !this.forOneItem) {
      (publicContent as any)['next_url'] = buildItemPaginationUrl(
        (publicContent as any)['feed_url'],
        {
          legacySort: this.content.items_sort_order,
          nextCursor: this.content.items_next_cursor,
          order: this.content.items_order,
          sort: this.content.items_sort,
        },
      );
    }

    (publicContent as any)['description'] = channel.description || '';

    if (channel.image) {
      (publicContent as any)['icon'] = urlJoinWithRelative(this.publicBucketUrl, channel.image, this.baseUrl);
    }

    if (this.webGlobalSettings.favicon && this.webGlobalSettings.favicon.url) {
        (publicContent as any)['favicon'] = urlJoinWithRelative(
          this.publicBucketUrl, this.webGlobalSettings.favicon.url, this.baseUrl);
    }

    if (channel.publisher) {
      (publicContent as any)['authors'] = [{
        'name': channel.publisher,
      }];
    }

    if (channel.language) {
      (publicContent as any)['language'] = channel.language;
    }

    if (channel['itunes:complete']) {
      (publicContent as any)['expired'] = true;
    }
    return publicContent;
  }

  _buildPublicContentMicrofeedExtra(publicContent: any) {
    const channel = this.content.channel || {};
    const subscribeMethods = this.settings.subscribeMethods || {'methods': []};
    const microfeedExtra: Record<string, any> = {
      microfeed_version: MICROFEED_VERSION,
      base_url: this.baseUrl,
      categories: [],
    };
    const channelCategories = channel.categories || [];
    channelCategories.forEach((c: any) => {
      const topAndSubCats = c.split('/');
      let cat;
      if (topAndSubCats) {
        if (topAndSubCats.length > 0) {
          cat = {
            'name': topAndSubCats[0].trim(),
          };
        }
        if (topAndSubCats.length > 1) {
          (cat as any)['categories'] = [{
            'name': topAndSubCats[1].trim(),
          }]
        }
      }
      if (cat) {
        microfeedExtra['categories'].push(cat);
      }
    });
    if (!subscribeMethods.methods) {
      (microfeedExtra as any)['subscribe_methods'] = '';
    } else {
      (microfeedExtra as any)['subscribe_methods'] = subscribeMethods.methods.filter((m: any) => m.enabled).map((m: any) => {
        // TODO: supports custom icons that are hosted on R2
        m.image = urlJoinWithRelative(this.publicBucketUrl, m.image, this.baseUrl);
        if (!m.editable) {
          switch (m.type) {
            case 'rss':
              m.url = PUBLIC_URLS.rssFeed(this.baseUrl);
              return m;
            case 'json':
              m.url = PUBLIC_URLS.jsonFeed(this.baseUrl);
              return m;
            default:
              return m;
          }
        }
        return m;
      });
    }
    (microfeedExtra as any)['description_text'] = htmlToPlainText(channel.description);

    if (channel['itunes:explicit']) {
      (microfeedExtra as any)['itunes:explicit'] = true;
    }
    if (channel['itunes:title']) {
      (microfeedExtra as any)['itunes:title'] = channel['itunes:title'];
    }
    if (channel['copyright']) {
      (microfeedExtra as any)['copyright'] = channel['copyright'];
    }
    if (channel['itunes:title']) {
      (microfeedExtra as any)['itunes:title'] = channel['itunes:title'];
    }
    if (channel['itunes:type']) {
      (microfeedExtra as any)['itunes:type'] = channel['itunes:type'];
    }
    if (channel['itunes:block']) {
      (microfeedExtra as any)['itunes:block'] = channel['itunes:block'];
    }
    if (channel['itunes:complete']) {
      (microfeedExtra as any)['itunes:complete'] = channel['itunes:complete'];
    }
    if (channel['itunes:new-feed-url']) {
      (microfeedExtra as any)['itunes:new-feed-url'] = channel['itunes:new-feed-url'];
    }
    if (channel['itunes:email']) {
      (microfeedExtra as any)['itunes:email'] = channel['itunes:email'];
    }
    if (this.content.items_sort_order) {
      (microfeedExtra as any)['items_sort_order'] = this.content.items_sort_order;
    } else {
      (microfeedExtra as any)['items_sort'] = this.content.items_sort;
      (microfeedExtra as any)['items_order'] = this.content.items_order;
    }
    if (this.content.items_next_cursor !== undefined && !this.forOneItem) {
      (microfeedExtra as any)['items_next_cursor'] = this.content.items_next_cursor;
      (microfeedExtra as any)['next_url'] = buildItemPaginationUrl(
        this.request.url,
        {
          legacySort: this.content.items_sort_order,
          nextCursor: this.content.items_next_cursor,
          order: this.content.items_order,
          sort: this.content.items_sort,
        },
      );
    }
    if (this.content.items_prev_cursor !== undefined && !this.forOneItem) {
      (microfeedExtra as any)['items_prev_cursor'] = this.content.items_prev_cursor;
      (microfeedExtra as any)['prev_url'] = buildItemPaginationUrl(
        publicContent['feed_url'],
        {
          legacySort: this.content.items_sort_order,
          order: this.content.items_order,
          prevCursor: this.content.items_prev_cursor,
          sort: this.content.items_sort,
        },
      );
    }
    return microfeedExtra;
  }

  _buildPublicContentItem(item: any, mediaFile: any) {
    let trackingUrls = [];
    if (this.settings.analytics && this.settings.analytics.urls) {
      trackingUrls = this.settings.analytics.urls || [];
    }

    const newItem = {
      id: item.id,
      title: item.title || 'untitled',
    };
    const attachment = {};
    const _microfeed = {
      is_audio: mediaFile.isAudio,
      is_document: mediaFile.isDocument,
      is_external_url: mediaFile.isExternalUrl,
      is_video: mediaFile.isVideo,
      is_image: mediaFile.isImage,
      web_url: item.webUrl,
      json_url: item.jsonUrl,
      rss_url: item.rssUrl,
      guid: item.guid,
      status: ITEM_STATUSES_DICT[item.status] ? (ITEM_STATUSES_DICT[item.status] as any).name : 'published',
    };

    if (isValidMediaFile(mediaFile)) {
      if (mediaFile.url) {
        (attachment as any)['url'] = buildAudioUrlWithTracking(mediaFile.url, trackingUrls);
      }
      if (mediaFile.contentType) {
        (attachment as any)['mime_type'] = mediaFile.contentType;
      }
      if (mediaFile.sizeByte) {
        (attachment as any)['size_in_byte'] = mediaFile.sizeByte;
      }
      if (mediaFile.durationSecond) {
        (attachment as any)['duration_in_seconds'] = mediaFile.durationSecond;
        (_microfeed as any)['duration_hhmmss'] = secondsToHHMMSS(mediaFile.durationSecond);
      }
      if (Object.keys(attachment).length > 0) {
        (newItem as any)['attachments'] = [attachment];
      }
    }
    if (item.link) {
      (newItem as any)['url'] = item.link;
    }
    if (mediaFile.isExternalUrl && mediaFile.url) {
      (newItem as any)['external_url'] = mediaFile.url;
    }

    (newItem as any)['content_html'] = item.description || '';
    (newItem as any)['content_text'] = item.descriptionText || '';

    if (item.image) {
      (newItem as any)['image'] = item.image;
    }
    if (mediaFile.isImage && mediaFile.url) {
      (newItem as any)['banner_image'] = mediaFile.url;
    }
    if (item.pubDateRfc3339) {
      (newItem as any)['date_published'] = item.pubDateRfc3339;
    }
    if (item.updatedDateRfc3339) {
      (newItem as any)['date_modified'] = item.updatedDateRfc3339;
    }
    if (item.language) {
      (newItem as any)['language'] = item.language;
    }

    if (item['itunes:title']) {
      (_microfeed as any)['itunes:title'] = item['itunes:title'];
    }
    if (item['itunes:block']) {
      (_microfeed as any)['itunes:block'] = item['itunes:block'];
    }
    if (item['itunes:episodeType']) {
      (_microfeed as any)['itunes:episodeType'] = item['itunes:episodeType'];
    }
    if (item['itunes:season']) {
      (_microfeed as any)['itunes:season'] = parseInt(item['itunes:season'], 10);
    }
    if (item['itunes:episode']) {
      (_microfeed as any)['itunes:episode'] = parseInt(item['itunes:episode'], 10);
    }
    if (item['itunes:explicit']) {
      (_microfeed as any)['itunes:explicit'] = item['itunes:explicit'];
    }
    if (item.pubDate) {
      (_microfeed as any)['date_published_short'] = item.pubDate;
    }
    if (item.pubDateMs) {
      (_microfeed as any)['date_published_ms'] = item.pubDateMs;
    }

    (newItem as any)['_microfeed'] = _microfeed;
    return newItem;
  }

  getJsonData() {
    const publicContent = {
      version: 'https://jsonfeed.org/version/1.1',
      ...this._buildPublicContentChannel(),
    };

    const {items} = this.content;
    const existingitems = items || [];
    (publicContent as any)['items'] = [];
    existingitems.forEach((item: any) => {
      if (![STATUSES.PUBLISHED, STATUSES.UNLISTED].includes(item.status)) {
        return;
      }
      this._decorateForItem(item, this.baseUrl);
      const mediaFile = item.mediaFile || {};
      const newItem = this._buildPublicContentItem(item, mediaFile);
      (publicContent as any).items.push(newItem);
    });

    // Note: We don't proactively sort items based on itunes:type.
    //       Instead, we rely on ?sort= query param and settings
    // if (channel['itunes:type'] === 'episodic') {
    //   publicContent.items.sort((a, b) => b['_microfeed']['date_published_ms'] - a['_microfeed']['date_published_ms']);
    // } else {
    //   publicContent.items.sort((a, b) => a['_microfeed']['date_published_ms'] - b['_microfeed']['date_published_ms']);
    // }

    (publicContent as any)['_microfeed'] = this._buildPublicContentMicrofeedExtra(publicContent);
    return publicContent;
  }
}
