import {XMLBuilder} from "fast-xml-parser";
import {PUBLIC_URLS, secondsToHHMMSS} from "@/shared/StringUtils";
import {msToUtcString} from "@/shared/TimeUtils";
import {OUR_BRAND} from "@/shared/Constants";
import {buildItemPaginationUrl} from "@/shared/ItemPagination";

export default class FeedPublicRssBuilder {
  [member: string]: any;

  constructor(jsonData: any, baseUrl: any) {
    this.jsonData = jsonData;
    this.baseUrl = baseUrl;
  }

  _buildItemsRss() {
   const items: any[] = [];
   this.jsonData.items.forEach((item: any) => {
     const _microfeed = item._microfeed || {};
     const itemJson = {
       'title': item.title || 'untitled',
       'guid': item.id,
       'pubDate': msToUtcString(item._microfeed.date_published_ms),
       'itunes:explicit': _microfeed['itunes:explicit'] ? 'true' : 'false',
     };
     if (item['content_html']) {
       (itemJson as any)['description'] = {
         '@cdata': item['content_html'],
       };
     }

     if (item['url']) {
       (itemJson as any)['link'] = item['url'];
     } else {
      // use _microfeed.web_url as the link to the item post
      (itemJson as any)['link'] = _microfeed['web_url'];
     }

     if (item.image) {
       (itemJson as any)['itunes:image'] = {
         '@_href': item.image,
       };
     }

     if (_microfeed['itunes:title'] && _microfeed['itunes:title'].trim().length > 0) {
       (itemJson as any)['itunes:title'] = _microfeed['itunes:title'].trim();
     }

     if (_microfeed['itunes:block']) {
       (itemJson as any)['itunes:block'] = 'Yes';
     }

     if (_microfeed['itunes:season']) {
       (itemJson as any)['itunes:season'] = _microfeed['itunes:season'];
     }

     if (_microfeed['itunes:episode']) {
       (itemJson as any)['itunes:episode'] = _microfeed['itunes:episode'];
     }

     if (['full', 'trailer', 'bonus'].includes(_microfeed['itunes:episodeType'])) {
       (itemJson as any)['itunes:episodeType'] = _microfeed['itunes:episodeType'];
     }

     const {attachments} = item;
     let mediaFile;
     if (attachments && attachments[0]) {
       mediaFile = attachments[0];
     }
     if (mediaFile && mediaFile.url && mediaFile.url.length > 0) {
       (itemJson as any).enclosure = {
         '@_url': mediaFile.url,
       };
       if (mediaFile.mime_type) {
         (itemJson as any).enclosure['@_type'] = mediaFile.mime_type;
       }
       if (mediaFile.size_in_byte && mediaFile.size_in_byte > 0) {
         (itemJson as any).enclosure['@_length'] = mediaFile.size_in_byte;
       }
       if (mediaFile.duration_in_seconds && mediaFile.duration_in_seconds > 0) {
         (itemJson as any)['itunes:duration'] = secondsToHHMMSS(mediaFile.duration_in_seconds);
       }
     }
     items.push(itemJson);
   });
   return items;
 }

  _buildChannelRss() {
    const _microfeed = this.jsonData._microfeed || {};
    const channelRss = {
      'title': this.jsonData.title,
      'language': this.jsonData.language,
      'generator': OUR_BRAND.domain,
      'itunes:type': _microfeed['itunes:type'],
      'itunes:explicit': _microfeed['itunes:explicit'] ? 'true' : 'false',
    };
    (channelRss as any)['atom:link'] = {
      '@_rel': 'self',
      '@_href': PUBLIC_URLS.rssFeed(this.baseUrl),
      '@_type': 'application/rss+xml',
    };
    const linksTags = [];
    if (this.jsonData.home_page_url) {
      linksTags.push(this.jsonData.home_page_url);
    }
    if (this.jsonData._microfeed.items_next_cursor !== undefined) {
      const {
        items_next_cursor,
        items_order,
        items_sort,
        items_sort_order,
      } = this.jsonData._microfeed;
      linksTags.push({
        '@_rel': 'next',
        '@_href': buildItemPaginationUrl(PUBLIC_URLS.rssFeed(this.baseUrl), {
          legacySort: items_sort_order,
          nextCursor: items_next_cursor,
          order: items_order,
          sort: items_sort,
        }),
        '@_type': 'application/rss+xml',
      });
    }
    if (this.jsonData._microfeed.items_prev_cursor !== undefined) {
      const {
        items_order,
        items_prev_cursor,
        items_sort,
        items_sort_order,
      } = this.jsonData._microfeed;
      linksTags.push({
        '@_rel': 'prev',
        '@_href': buildItemPaginationUrl(PUBLIC_URLS.rssFeed(this.baseUrl), {
          legacySort: items_sort_order,
          order: items_order,
          prevCursor: items_prev_cursor,
          sort: items_sort,
        }),
        '@_type': 'application/rss+xml',
      });
    }
    (channelRss as any)['link'] = linksTags;
    if (this.jsonData.description) {
      (channelRss as any)['description'] = {
        '@cdata': this.jsonData.description,
      };
    }
    if (this.jsonData.authors && this.jsonData.authors.length > 0 && this.jsonData.authors[0].name) {
      (channelRss as any)['itunes:author'] = this.jsonData.authors[0].name;
    }
    if (this.jsonData.icon) {
      (channelRss as any)['itunes:image'] = {
        '@_href': this.jsonData.icon,
      };
      (channelRss as any).image = {
        'title': this.jsonData.title,
        'url': this.jsonData.icon,
        'link': this.jsonData.home_page_url,
      };
    }
    if (_microfeed.copyright && _microfeed.copyright.trim().length > 0) {
      (channelRss as any).copyright = _microfeed.copyright.trim();
    }
    if (_microfeed['itunes:email'] && _microfeed['itunes:email'].trim().length > 0) {
      (channelRss as any)['itunes:owner'] = {
        'itunes:email': _microfeed['itunes:email'].trim(),
      };
      if ((channelRss as any)['itunes:author']) {
        (channelRss as any)['itunes:owner']['itunes:name'] = (channelRss as any)['itunes:author'];
      }
    }
    if (_microfeed['itunes:new-feed-url'] && _microfeed['itunes:new-feed-url'].trim().length > 0) {
      (channelRss as any)['itunes:new-feed-url'] = _microfeed['itunes:new-feed-url'].trim();
    }
    if (_microfeed['itunes:block']) {
      (channelRss as any)['itunes:block'] = 'Yes';
    }
    if (_microfeed['itunes:complete']) {
      (channelRss as any)['itunes:complete'] = 'Yes';
    }
    if (_microfeed['itunes:title'] && _microfeed['itunes:title'].trim().length > 0) {
      (channelRss as any)['itunes:title'] = _microfeed['itunes:title'].trim();
    }
    if (_microfeed['categories'] && _microfeed['categories'].length > 0) {
      const categories: any[] = [];
      _microfeed['categories'].forEach((c: any) => {
        let cat = {
          '@_text': c.name,
        };

        if (c.categories && c.categories.length > 0 && c.categories[0].name) {
          (cat as any)['itunes:category'] = {
            '@_text': c.categories[0].name,
          }
        }
        categories.push(cat);
      });
      (channelRss as any)['itunes:category'] = categories;
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
      // arrayNodeName: "item",
    });
    const xmlOutput = builder.build(input);

    return "<?xml version='1.0' encoding='UTF-8'?>\n" +
      `<?xml-stylesheet href="${PUBLIC_URLS.rssFeedStylesheet()}" type="text/xsl"?>\n` +
      "<rss xmlns:content='http://purl.org/rss/1.0/modules/content/' xmlns:taxo='http://purl.org/rss/1.0/modules/taxonomy/' xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:itunes='http://www.itunes.com/dtds/podcast-1.0.dtd' xmlns:googleplay=\"http://www.google.com/schemas/play-podcasts/1.0\" xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:atom='http://www.w3.org/2005/Atom' xmlns:podbridge='http://www.podbridge.com/podbridge-ad.dtd' version='2.0'>\n" +
      xmlOutput + '</rss>';
  }
}
