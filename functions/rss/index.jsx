import Feed from "../../edge-src/models/Feed";
import {msToUtcString} from "../../common-src/TimeUtils";
import {secondsToHHMMSS} from "../../common-src/StringUtils";

const { XMLBuilder } = require('fast-xml-parser');

export async function onRequestGet({request, env}) {
  const feed = new Feed(env);
  const jsonData = await feed.getContentPublic();

  const items = [];
  jsonData.episodes.forEach((item) => {
    items.push({
      'title': item.title || 'Untitled',
      'description': {
        '@cdata': item.description,
      },
      'itunes:summary': {
        '@cdata': item.description,
      },
      'link': item.link,
      'itunes:duration': secondsToHHMMSS(item.audioDurationSecond),
      'guid': item.guid,
      'pubDate': msToUtcString(item.pubDateMs),
      'enclosure': {
        '@_url': item.audio,
        '@_type': item.audioFileType,
      },
    });
  });

  const input = {
    "channel": {
      'title': jsonData.podcast.title,
      'atom:link': {
        '@_rel': 'self',
        '@_href': request.url,
        '@_type': 'application/rss+xml',
      },
      'link': jsonData.podcast.link,
      'itunes:author': jsonData.podcast.publisher,
      'image': {
        'title': jsonData.podcast.title,
        'url': jsonData.podcast.image,
        'link': jsonData.podcast.link,
      },
      'description': {
        '@cdata': jsonData.podcast.description,
      },
      'item': items,
    }
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix : "@_",
    suppressEmptyNode: true,
    format: true,
    cdataPropName: '@cdata',
    // arrayNodeName: "item",
  });
  const xmlOutput = builder.build(input);

  const xmlContent = "<?xml version='1.0' encoding='UTF-8'?>\n" +
    '<?xml-stylesheet href="/rss/stylesheet/" type="text/xsl"?>\n' +
    "<rss xmlns:content='http://purl.org/rss/1.0/modules/content/' xmlns:taxo='http://purl.org/rss/1.0/modules/taxonomy/' xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:itunes='http://www.itunes.com/dtds/podcast-1.0.dtd' xmlns:googleplay=\"http://www.google.com/schemas/play-podcasts/1.0\" xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:atom='http://www.w3.org/2005/Atom' xmlns:podbridge='http://www.podbridge.com/podbridge-ad.dtd' version='2.0'>\n" +
    xmlOutput +
    '</rss>';
  return new Response(xmlContent, {
      headers: {
        'content-type': 'application/xml',
      },
  });
}
