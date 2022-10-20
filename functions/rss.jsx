// import React from "react";
// import ReactDOMServer from "react-dom/server";
// import FeedApp from '../edge-src/FeedApp';
import PodcastData from "../edge-src/common/PodcastData";

const { XMLBuilder } = require('fast-xml-parser');

export async function onRequestGet({request, env, params, waitUntil, next, data}) {
  const podcastData = new PodcastData();
  const jsonData = await podcastData.getData();

  const items = [];
  jsonData.items.forEach((item) => {
    items.push({
      'title': item.data.title,
      'description': {
        '@cdata': item.data.description,
      },
      'itunes:summary': {
        '@cdata': item.data.description,
      },
      'itunes:duration': item.data.audio_length_sec,
      'guid': item.data.listennotes_url,
      'pubDate': item.data.pub_date_ms,
      'enclosure': {
        '@_url': item.data.audio,
        '@_type': 'audio/mpeg',
      },
    });
  });

  const input = {
    "channel": {
      'title': jsonData.name,
      'atom:link': {
        '@_rel': 'self',
        '@_href': request.url,
        '@_type': 'application/rss+xml',
      },
      'link': jsonData.listennotes_url,
      'itunes:author': 'Wenbin Fang',
      'image': {
        'title': jsonData.name,
        'url': jsonData.image,
        'link': jsonData.listennotes_url,
      },
      'description': {
        '@cdata': jsonData.description,
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
    '<?xml-stylesheet href="/assets/rss/stylesheet.xsl" type="text/xsl"?>\n' +
    "<rss xmlns:content='http://purl.org/rss/1.0/modules/content/' xmlns:taxo='http://purl.org/rss/1.0/modules/taxonomy/' xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:itunes='http://www.itunes.com/dtds/podcast-1.0.dtd' xmlns:googleplay=\"http://www.google.com/schemas/play-podcasts/1.0\" xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:atom='http://www.w3.org/2005/Atom' xmlns:podbridge='http://www.podbridge.com/podbridge-ad.dtd' version='2.0'>\n" +
    xmlOutput +
    '</rss>';
  return new Response(xmlContent, {
      headers: {
        'content-type': 'application/xml',
      },
  });
}
