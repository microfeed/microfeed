import {msToUtcString} from "../../common-src/TimeUtils";
import {secondsToHHMMSS} from "../../common-src/StringUtils";
import {PUBLIC_URLS} from "../../common-src/StringUtils";
import {RssResponseBuilder} from "../../edge-src/common/PageUtils";
import {OUR_BRAND} from '../../common-src/Constants';

const {XMLBuilder} = require('fast-xml-parser');

function buildItemsRss(jsonData) {
  const items = [];
  jsonData.items.forEach((item) => {
    const _microfeed = item._microfeed || {};
    const itemJson = {
      'title': item.title || 'untitled',
      'guid': item.id,
      'pubDate': msToUtcString(item._microfeed.date_published_ms),
      'itunes:explicit': _microfeed['itunes:explicit'] ? 'true' : 'false',
    };
    if (item['content_html']) {
      itemJson['description'] = {
        '@cdata': item['content_html'],
      };
    }
    if (item['url']) {
      itemJson['link'] = item['url'];
    }

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

    const {attachments} = item;
    let mediaFile;
    if (attachments && attachments[0]) {
      mediaFile = attachments[0];
    }
    if (mediaFile && mediaFile.url && mediaFile.url.length > 0) {
      itemJson.enclosure = {
        '@_url': mediaFile.url,
      };
      if (mediaFile.mime_type) {
        itemJson.enclosure['@_type'] = mediaFile.mime_type;
      }
      if (mediaFile.size_in_byte && mediaFile.size_in_byte > 0) {
        itemJson.enclosure['@_length'] = mediaFile.size_in_byte;
      }
      if (mediaFile.duration_in_seconds && mediaFile.duration_in_seconds > 0) {
        itemJson['itunes:duration'] = secondsToHHMMSS(mediaFile.duration_in_seconds);
      }
    }
    items.push(itemJson);
  });
  return items;
}

function buildChannelRss(jsonData, request) {
  const _microfeed = jsonData._microfeed || {};
  const baseUrl = (new URL(request.url)).origin;
  const channelRss = {
    'title': jsonData.title,
    'language': jsonData.language,
    'generator': OUR_BRAND.domain,
    'itunes:type': _microfeed['itunes:type'],
    'itunes:explicit': _microfeed['itunes:explicit'] ? 'true' : 'false',
  };
  channelRss['atom:link'] = {
    '@_rel': 'self',
    '@_href': PUBLIC_URLS.rssFeed(baseUrl),
    '@_type': 'application/rss+xml',
  };
  const linksTags = [];
  if (jsonData.home_page_url) {
    linksTags.push(jsonData.home_page_url);
  }
  if (jsonData._microfeed.items_next_cursor) {
    const {items_next_cursor, items_sort_order} = jsonData._microfeed;
    linksTags.push({
      '@_rel': 'next',
      '@_href': `${PUBLIC_URLS.rssFeed(baseUrl)}?next_cursor=${items_next_cursor}&sort=${items_sort_order}`,
      '@_type': 'application/rss+xml',
    });
  }
  if (jsonData._microfeed.items_prev_cursor) {
    const {items_prev_cursor, items_sort_order} = jsonData._microfeed;
    linksTags.push({
      '@_rel': 'prev',
      '@_href': `${PUBLIC_URLS.rssFeed(baseUrl)}?prev_cursor=${items_prev_cursor}&sort=${items_sort_order}`,
      '@_type': 'application/rss+xml',
    });
  }
  channelRss['link'] = linksTags;
  if (jsonData.description) {
    channelRss['description'] = {
      '@cdata': jsonData.description,
    };
  }
  if (jsonData.authors && jsonData.authors.length > 0 && jsonData.authors[0].name) {
    channelRss['itunes:author'] = jsonData.authors[0].name;
  }
  if (jsonData.icon) {
    channelRss['itunes:image'] = {
      '@_href': jsonData.icon,
    };
    channelRss.image = {
      'title': jsonData.title,
      'url': jsonData.icon,
      'link': jsonData.home_page_url,
    };
  }
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
  return channelRss;
}

export async function onRequestGet({request, env}) {
  const rssResponseBuilder = new RssResponseBuilder(env, request);
  return await rssResponseBuilder.getResponse({
    buildXmlFunc: (jsonData) => {
      const items = buildItemsRss(jsonData);
      const channelRss = buildChannelRss(jsonData, request);
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
        // arrayNodeName: "item",
      });
      const xmlOutput = builder.build(input);

      return "<?xml version='1.0' encoding='UTF-8'?>\n" +
        `<?xml-stylesheet href="${PUBLIC_URLS.rssFeedStylesheet()}" type="text/xsl"?>\n` +
        "<rss xmlns:content='http://purl.org/rss/1.0/modules/content/' xmlns:taxo='http://purl.org/rss/1.0/modules/taxonomy/' xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:itunes='http://www.itunes.com/dtds/podcast-1.0.dtd' xmlns:googleplay=\"http://www.google.com/schemas/play-podcasts/1.0\" xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:atom='http://www.w3.org/2005/Atom' xmlns:podbridge='http://www.podbridge.com/podbridge-ad.dtd' version='2.0'>\n" +
        xmlOutput + '</rss>';
    }
  });
}
