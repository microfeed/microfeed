// import React from "react";
// import ReactDOMServer from "react-dom/server";
// import FeedApp from '../edge-src/FeedApp';
const { XMLBuilder } = require('fast-xml-parser');

export async function onRequestGet({request, env, params, waitUntil, next, data}) {
  const items = [
    {
      'title': 'Revolutionizing podcasting + standards vs. innovation with Anchor Co-Founder Mike Mignano | E1520',
      'pubDate': 'Thu, 28 Jul 2022 16:10:02 -0700',
    },
    {
      'title': '#1014 Oscar Merry On Pioneering Listen To Earn With Bitcoin',
      'pubDate': 'Thu, 28 Jul 2022 16:10:02 -0700',
    }
  ];
  const input = {
    "channel": {
      'title': 'Podcasts about podcasting',
      'atom:link': {
        '@_rel': 'self',
        '@_href': 'https://www.listennotes.com/listen/podcasts-about-podcasting-m1pe7z60bsw/rss/?sort_type=recent_added_first',
        '@_type': 'application/rss+xml',
      },
      'link': 'https://www.listennotes.com/playlists/podcasts-about-podcasting-m1pe7z60bsw/episodes/',
      'itunes:author': 'Wenbin Fang / Listen Notes',
      'image': {
        'title': 'Podcasts about podcasting',
        'url': 'https://production.listennotes.com/podcast-playlists/podcasts-about-podcasting-4bU7MZIlEVO-m1pe7z60bsw.1600x1600.jpg',
        'link': 'https://www.listennotes.com/playlists/podcasts-about-podcasting-m1pe7z60bsw/episodes/',
      },
      'description': {
        '@cdata': 'A curated playlist of podcasts by Wenbin Fang.'
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
