import {msToUtcString} from "../../common-src/TimeUtils";
import {secondsToHHMMSS} from "../../common-src/StringUtils";
import {PUBLIC_URLS} from "../../common-src/StringUtils";
import {RssResponseBuilder} from "../../edge-src/common/PublicPageUtils";
import {OUR_BRAND} from '../../common-src/Constants';

const {XMLBuilder} = require('fast-xml-parser');

export async function onRequestGet({request, env}) {
  const rssResponseBuilder = new RssResponseBuilder(env);
  return await rssResponseBuilder.getResponse({
    buildXmlFunc: (jsonData) => {
      const items = [];
      jsonData.items.forEach((item) => {
        const itemJson = {
          'title': item.title || 'Untitled',
          'description': {
            '@cdata': item.description,
          },
          'itunes:summary': {
            '@cdata': item.description,
          },
          'link': item.link,
          'guid': item.guid,
          'pubDate': msToUtcString(item.pubDateMs),
        };
        const {mediaFile} = item;

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

      const {channel} = jsonData;
      const input = {
        "channel": {
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
          'item': items,
        }
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
