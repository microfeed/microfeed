import {XMLBuilder} from "fast-xml-parser";
import {PUBLIC_URLS, secondsToHHMMSS} from "../../common-src/StringUtils";
import {msToUtcString} from "../../common-src/TimeUtils";
import {ENCLOSURE_CATEGORIES} from "../../common-src/Constants";
import {resolveBrand} from "../../common-src/BrandUtils";
import {getRssKind} from "../registry/ContentTypeRegistry";

export default class FeedPublicRssBuilder {
  /**
   * options.contentType: filter jsonData.items to this content_type (e.g.
   *   "podcast_episode", "blog_article") and, unless options.rssKind is
   *   given explicitly, derive the RSS flavor from the registry via
   *   getRssKind(contentType) ("itunes" | "basic" | null).
   * options.rssKind: explicit override ("itunes" | "basic" | null).
   *
   * Backward compatibility: when contentType/rssKind are both omitted (the
   * legacy single-feed callers in functions/rss and functions/i/[slug]/rss),
   * the builder keeps its original behavior — every item in jsonData.items,
   * rendered as a full iTunes podcast RSS feed.
   */
  constructor(jsonData, baseUrl, options = {}) {
    this.jsonData = jsonData || {};
    this.baseUrl = baseUrl;
    this.contentType = options.contentType;
    this.legacyMode = options.contentType === undefined && options.rssKind === undefined;
    this.rssKind = options.rssKind !== undefined
      ? options.rssKind
      : (this.legacyMode ? "itunes" : getRssKind(this.contentType));
  }

  _itemsForContentType() {
    const items = this.jsonData.items || [];
    if (this.legacyMode) {
      return items;
    }
    // A content type with no rss mapping (rssKind null) never renders items,
    // even if items of that type exist in the feed data.
    if (!this.rssKind) {
      return [];
    }
    if (!this.contentType) {
      return items;
    }
    return items.filter((item) => item.content_type === this.contentType);
  }

  _buildItunesItemExtras(itemJson, item) {
    const _microfeed = item._microfeed || {};

    itemJson['itunes:explicit'] = _microfeed['itunes:explicit'] ? 'true' : 'false';

    if (item.image) {
      itemJson['itunes:image'] = {
        '@_href': item.image,
      };
    }

    if (_microfeed['itunes:title'] && _microfeed['itunes:title'].trim().length > 0) {
      itemJson['itunes:title'] = _microfeed['itunes:title'].trim();
    }

    if (_microfeed['itunes:block']) {
      itemJson['itunes:block'] = 'Yes';
    }

    if (_microfeed['itunes:season']) {
      itemJson['itunes:season'] = _microfeed['itunes:season'];
    }

    if (_microfeed['itunes:episode']) {
      itemJson['itunes:episode'] = _microfeed['itunes:episode'];
    }

    if (['full', 'trailer', 'bonus'].includes(_microfeed['itunes:episodeType'])) {
      itemJson['itunes:episodeType'] = _microfeed['itunes:episodeType'];
    }

    const attachment = item.attachment;
    if (attachment && attachment.url && attachment.category !== ENCLOSURE_CATEGORIES.EXTERNAL_URL) {
      itemJson.enclosure = {
        '@_url': attachment.url,
      };
      if (attachment.mime_type) {
        itemJson.enclosure['@_type'] = attachment.mime_type;
      }
      if (attachment.size_in_bytes && attachment.size_in_bytes > 0) {
        itemJson.enclosure['@_length'] = attachment.size_in_bytes;
      }
      if (attachment.duration_in_seconds && attachment.duration_in_seconds > 0) {
        itemJson['itunes:duration'] = secondsToHHMMSS(attachment.duration_in_seconds);
      }
    }
  }

  _buildItemRss(item) {
    const itemJson = {
      'title': item.title || 'untitled',
      'guid': item.id,
    };

    if (item.date_published_ms !== undefined && item.date_published_ms !== null) {
      itemJson['pubDate'] = msToUtcString(item.date_published_ms);
    }

    if (item['content_html']) {
      itemJson['description'] = {
        '@cdata': item['content_html'],
      };
    }

    if (item['url']) {
      itemJson['link'] = item['url'];
    }

    if (this.rssKind === 'itunes') {
      this._buildItunesItemExtras(itemJson, item);
    }

    return itemJson;
  }

  _buildItemsRss() {
    return this._itemsForContentType().map((item) => this._buildItemRss(item));
  }

  _buildChannelRss() {
    const _microfeed = this.jsonData._microfeed || {};
    const channelRss = {
      'title': this.jsonData.title,
      'language': this.jsonData.language,
      'generator': resolveBrand(this.jsonData.settings).brandDomain,
    };

    if (this.rssKind === 'itunes') {
      channelRss['itunes:type'] = _microfeed['itunes:type'];
      channelRss['itunes:explicit'] = _microfeed['itunes:explicit'] ? 'true' : 'false';
    }

    channelRss['atom:link'] = {
      '@_rel': 'self',
      '@_href': PUBLIC_URLS.rssFeed(this.baseUrl),
      '@_type': 'application/rss+xml',
    };
    const linksTags = [];
    if (this.jsonData.home_page_url) {
      linksTags.push(this.jsonData.home_page_url);
    }
    if (linksTags.length > 0) {
      channelRss['link'] = linksTags;
    }
    if (this.jsonData.description) {
      channelRss['description'] = {
        '@cdata': this.jsonData.description,
      };
    }
    if (this.jsonData.authors && this.jsonData.authors.length > 0 && this.jsonData.authors[0].name) {
      if (this.rssKind === 'itunes') {
        channelRss['itunes:author'] = this.jsonData.authors[0].name;
      }
    }
    if (this.jsonData.icon) {
      if (this.rssKind === 'itunes') {
        channelRss['itunes:image'] = {
          '@_href': this.jsonData.icon,
        };
      }
      channelRss.image = {
        'title': this.jsonData.title,
        'url': this.jsonData.icon,
        'link': this.jsonData.home_page_url,
      };
    }

    if (this.rssKind === 'itunes') {
      if (_microfeed.copyright && _microfeed.copyright.trim().length > 0) {
        channelRss.copyright = _microfeed.copyright.trim();
      }
      if (_microfeed['itunes:email'] && _microfeed['itunes:email'].trim().length > 0) {
        channelRss['itunes:owner'] = {
          'itunes:email': _microfeed['itunes:email'].trim(),
        };
        if (channelRss['itunes:author']) {
          channelRss['itunes:owner']['itunes:name'] = channelRss['itunes:author'];
        }
      }
      if (_microfeed['itunes:new-feed-url'] && _microfeed['itunes:new-feed-url'].trim().length > 0) {
        channelRss['itunes:new-feed-url'] = _microfeed['itunes:new-feed-url'].trim();
      }
      if (_microfeed['itunes:block']) {
        channelRss['itunes:block'] = 'Yes';
      }
      if (_microfeed['itunes:complete']) {
        channelRss['itunes:complete'] = 'Yes';
      }
      if (_microfeed['itunes:title'] && _microfeed['itunes:title'].trim().length > 0) {
        channelRss['itunes:title'] = _microfeed['itunes:title'].trim();
      }
      if (_microfeed['categories'] && _microfeed['categories'].length > 0) {
        const categories = [];
        _microfeed['categories'].forEach((c) => {
          let cat = {
            '@_text': c.name,
          };

          if (c.categories && c.categories.length > 0 && c.categories[0].name) {
            cat['itunes:category'] = {
              '@_text': c.categories[0].name,
            }
          }
          categories.push(cat);
        });
        channelRss['itunes:category'] = categories;
      }
    }
    return channelRss;
  }

  getRssData() {
    const items = this._buildItemsRss();
    const channelRss = this._buildChannelRss();
    const input = {
      "channel": {
        ...channelRss,
        ...(items.length > 0 ? {'item': items} : {}),
      },
    };

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      suppressEmptyNode: true,
      format: true,
      cdataPropName: '@cdata',
      arrayNodeName: 'itunes:category',
    });
    const xmlOutput = builder.build(input);

    return "<?xml version='1.0' encoding='UTF-8'?>\n" +
      "<rss xmlns:content='http://purl.org/rss/1.0/modules/content/' xmlns:taxo='http://purl.org/rss/1.0/modules/taxonomy/' xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:itunes='http://www.itunes.com/dtds/podcast-1.0.dtd' xmlns:googleplay=\"http://www.google.com/schemas/play-podcasts/1.0\" xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:atom='http://www.w3.org/2005/Atom' xmlns:podbridge='http://www.podbridge.com/podbridge-ad.dtd' version='2.0'>\n" +
      xmlOutput + '</rss>';
  }
}
