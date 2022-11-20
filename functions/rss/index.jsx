import {msToUtcString} from "../../common-src/TimeUtils";
import {secondsToHHMMSS} from "../../common-src/StringUtils";
import {PUBLIC_URLS} from "../../common-src/StringUtils";
import {RssResponseBuilder} from "../../edge-src/common/PageUtils";
import {OUR_BRAND} from '../../common-src/Constants';

const {XMLBuilder} = require('fast-xml-parser');

function buildItemsRss(jsonData) {
  const items = [];
  jsonData.items.forEach((item) => {
    const itemJson = {
      'title': item.title || 'Untitled',
      'description': {
        '@cdata': item.description,
      },
      'link': item.link,
      'guid': item.guid,
      'pubDate': msToUtcString(item.pubDateMs),
      'itunes:explicit': item.explicit ? 'true' : 'false',
    };
    const {mediaFile} = item;

    if (item['itunes:title'] && item['itunes:title'].trim().length > 0) {
      itemJson['itunes:title'] = item['itunes:title'].trim();
    }

    if (item['itunes:block']) {
      itemJson['itunes:block'] = 'Yes';
    }

    if (item['itunes:season']) {
      itemJson['itunes:season'] = item['itunes:season'];
    }

    if (item['itunes:episode']) {
      itemJson['itunes:episode'] = item['itunes:episode'];
    }

    if (['full', 'trailer', 'bonus'].includes(item['itunes:episodeType'])) {
      itemJson['itunes:episodeType'] = item['itunes:episodeType'];
    }

    if (mediaFile && mediaFile.url && mediaFile.url.length > 0) {
      itemJson.enclosure = {
        '@_url': mediaFile.url,
      };
      if (mediaFile.contentType) {
        itemJson.enclosure['@_type'] = mediaFile.contentType;
      }
      if (mediaFile.sizeByte && mediaFile.sizeByte > 0) {
        itemJson.enclosure['@_length'] = mediaFile.sizeByte;
      }
      if (mediaFile.durationSecond && mediaFile.durationSecond > 0) {
        itemJson['itunes:duration'] = secondsToHHMMSS(item.mediaFile.durationSecond);
      }
    }
    items.push(itemJson);
  });
  return items;
}

function buildChannelRss(jsonData, request) {
  const {channel} = jsonData;
  const channelRss = {
    'title': channel.title,
    'atom:link': {
      '@_rel': 'self',
      '@_href': request.url,
      '@_type': 'application/rss+xml',
    },
    'link': channel.link,
    'itunes:author': channel.publisher,
    'image': {
      'title': channel.title,
      'url': channel.image,
      'link': channel.link,
    },
    'description': {
      '@cdata': channel.description,
    },
    'generator': OUR_BRAND.domain,
    'itunes:type': channel['itunes:type'],
    'itunes:explicit': channel.explicit ? 'true' : 'false',
  };

  if (channel.copyright && channel.copyright.trim().length > 0) {
    channelRss.copyright = channel.copyright.trim();
  }
  if (channel['itunes:email'] && channel['itunes:email'].trim().length > 0) {
    channelRss['itunes:owner'] = {
      'itunes:email': channel['itunes:email'].trim(),
      'itunes:name': channel.publisher,
    };
  }
  if (channel['itunes:new-feed-url'] && channel['itunes:new-feed-url'].trim().length > 0) {
    channelRss['itunes:new-feed-url'] = channel['itunes:new-feed-url'].trim();
  }
  if (channel['itunes:block']) {
    channelRss['itunes:block'] = 'Yes';
  }
  if (channel['itunes:complete']) {
    channelRss['itunes:complete'] = 'Yes';
  }
  if (channel['itunes:title'] && channel['itunes:title'].trim().length > 0) {
    channelRss['itunes:title'] = channel['itunes:title'].trim();
  }
  return channelRss;
}

export async function onRequestGet({request, env}) {
  const rssResponseBuilder = new RssResponseBuilder(env);
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
        // arrayNodeName: "item",
      });
      const xmlOutput = builder.build(input);

      return "<?xml version='1.0' encoding='UTF-8'?>\n" +
        `<?xml-stylesheet href="${PUBLIC_URLS.feedRssStylesheet()}" type="text/xsl"?>\n` +
        "<rss xmlns:content='http://purl.org/rss/1.0/modules/content/' xmlns:taxo='http://purl.org/rss/1.0/modules/taxonomy/' xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:itunes='http://www.itunes.com/dtds/podcast-1.0.dtd' xmlns:googleplay=\"http://www.google.com/schemas/play-podcasts/1.0\" xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:atom='http://www.w3.org/2005/Atom' xmlns:podbridge='http://www.podbridge.com/podbridge-ad.dtd' version='2.0'>\n" +
        xmlOutput + '</rss>';
    }
  });
}
