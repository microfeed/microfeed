import {XMLBuilder} from "fast-xml-parser";
import {PUBLIC_URLS, secondsToHHMMSS} from "../../common-src/StringUtils";
import {msToUtcString} from "../../common-src/TimeUtils";
import {OUR_BRAND} from "../../common-src/Constants";

/**
 * FeedRssBuilder converts a plain schema object to RSS XML format
 */
export default class FeedRssBuilder {
  constructor(schema) {
    this.schema = schema;
  }

  _buildItemsRss() {
    const items = [];
    this.schema.items.forEach((item) => {
      const itemJson = {
        'title': item.title,
        'guid': item.id,
        'pubDate': msToUtcString(item.pubDateMs),
        'itunes:explicit': item.itunes.explicit ? 'true' : 'false',
      };

      // Add new fields
      if (item.subtitle) {
        itemJson['subtitle'] = item.subtitle;
      }
      if (item.desc) {
        itemJson['desc'] = item.desc;
      }
      if (item.buttonText) {
        itemJson['buttonText'] = item.buttonText;
      }
      if (item.name) {
        itemJson['name'] = item.name;
      }
      if (typeof item.enabled === 'boolean') {
        itemJson['enabled'] = item.enabled ? 'true' : 'false';
      }
      if (item.custom_link) {
        itemJson['customLink'] = item.custom_link;
      }

      // Add description
      if (item.description) {
        itemJson['description'] = {
          '@cdata': item.description,
        };
      }

      // Add link
      if (item.link) {
        itemJson['link'] = item.link;
      } else {
        itemJson['link'] = item.webUrl;
      }

      // Add image
      if (item.image) {
        itemJson['itunes:image'] = {
          '@_href': item.image,
        };
      }

      // Add iTunes metadata
      if (item.itunes.title && item.itunes.title.trim().length > 0) {
        itemJson['itunes:title'] = item.itunes.title.trim();
      }
      if (item.itunes.block) {
        itemJson['itunes:block'] = 'Yes';
      }
      if (item.itunes.season) {
        itemJson['itunes:season'] = item.itunes.season;
      }
      if (item.itunes.episode) {
        itemJson['itunes:episode'] = item.itunes.episode;
      }
      if (['full', 'trailer', 'bonus'].includes(item.itunes.episodeType)) {
        itemJson['itunes:episodeType'] = item.itunes.episodeType;
      }

      // Add media file/attachment
      if (item.attachment && item.attachment.url && item.attachment.url.length > 0) {
        itemJson.enclosure = {
          '@_url': item.attachment.url,
        };
        if (item.attachment.mimeType) {
          itemJson.enclosure['@_type'] = item.attachment.mimeType;
        }
        if (item.attachment.sizeByte && item.attachment.sizeByte > 0) {
          itemJson.enclosure['@_length'] = item.attachment.sizeByte;
        }
        if (item.attachment.durationSecond && item.attachment.durationSecond > 0) {
          itemJson['itunes:duration'] = secondsToHHMMSS(item.attachment.durationSecond);
        }
      }

      items.push(itemJson);
    });
    return items;
  }

  _buildChannelRss() {
    const {channel, meta} = this.schema;
    const channelRss = {
      'title': channel.title,
      'language': channel.language,
      'generator': OUR_BRAND.domain,
      'itunes:explicit': 'false', // Default, can be overridden
    };

    channelRss['atom:link'] = {
      '@_rel': 'self',
      '@_href': PUBLIC_URLS.rssFeed(meta.baseUrl),
      '@_type': 'application/rss+xml',
    };

    const linksTags = [];
    if (channel.link) {
      linksTags.push(channel.link);
    }
    if (meta.itemsNextCursor) {
      linksTags.push({
        '@_rel': 'next',
        '@_href': `${PUBLIC_URLS.rssFeed(meta.baseUrl)}?next_cursor=${meta.itemsNextCursor}&sort=${meta.itemsSortOrder}`,
        '@_type': 'application/rss+xml',
      });
    }
    if (meta.itemsPrevCursor) {
      linksTags.push({
        '@_rel': 'prev',
        '@_href': `${PUBLIC_URLS.rssFeed(meta.baseUrl)}?prev_cursor=${meta.itemsPrevCursor}&sort=${meta.itemsSortOrder}`,
        '@_type': 'application/rss+xml',
      });
    }
    channelRss['link'] = linksTags;

    if (channel.description) {
      channelRss['description'] = {
        '@cdata': channel.description,
      };
    }

    if (channel.publisher) {
      channelRss['itunes:author'] = channel.publisher;
    }

    if (channel.image) {
      channelRss['itunes:image'] = {
        '@_href': channel.image,
      };
      channelRss.image = {
        'title': channel.title,
        'url': channel.image,
        'link': channel.link,
      };
    }

    return channelRss;
  }

  getRssData() {
    const items = this._buildItemsRss();
    const channelRss = this._buildChannelRss();
    const input = {
      "channel": {
        ...channelRss,
        'item': items,
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
      `<?xml-stylesheet href="${PUBLIC_URLS.rssFeedStylesheet()}" type="text/xsl"?>\n` +
      "<rss xmlns:content='http://purl.org/rss/1.0/modules/content/' xmlns:taxo='http://purl.org/rss/1.0/modules/taxonomy/' xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:itunes='http://www.itunes.com/dtds/podcast-1.0.dtd' xmlns:googleplay=\"http://www.google.com/schemas/play-podcasts/1.0\" xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:atom='http://www.w3.org/2005/Atom' xmlns:podbridge='http://www.podbridge.com/podbridge-ad.dtd' version='2.0'>\n" +
      xmlOutput + '</rss>';
  }
}
