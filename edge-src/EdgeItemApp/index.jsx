import React from 'react';
import HtmlHeader from "../components/HtmlHeader";
import {htmlMetaDescription} from "../../common-src/StringUtils";

export default class EdgeItemApp extends React.Component {
  render() {
    const {item, theme, jsonData, canonicalUrl} = this.props;
    const {html} = theme.getWebItem(item);
    const siteSeo = (jsonData._microfeed && jsonData._microfeed.site_seo) ? jsonData._microfeed.site_seo : {};
    const itemSeo = item._microfeed && item._microfeed.seo ? item._microfeed.seo : {};
    const title = itemSeo.title || item.title;
    const description = itemSeo.description || htmlMetaDescription(item.content_text, false);
    const resolvedCanonicalUrl = itemSeo.canonical_url || canonicalUrl || (item._microfeed ? item._microfeed.web_url : null);
    const ogImage = itemSeo.og_image || item.image || siteSeo.default_og_image || jsonData.icon;
    const typeSlug = item._microfeed && item._microfeed.type ? item._microfeed.type.slug : null;
    const ogType = typeSlug === 'video' ? 'video.other' : 'article';
    const og = {
      title,
      description,
      image: ogImage,
      type: ogType,
      url: resolvedCanonicalUrl,
      siteName: siteSeo.site_name || jsonData.title,
    };
    const twitter = {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      image: ogImage,
      site: siteSeo.twitter_handle || '',
    };
    const robots = itemSeo.noindex ? 'noindex, nofollow' : null;
    const attachments = item.attachments || [];
    const firstAttachment = attachments.length > 0 ? attachments[0] : null;
    let schemaType = 'Article';
    if (typeSlug === 'podcast') {
      schemaType = 'PodcastEpisode';
    } else if (typeSlug === 'video') {
      schemaType = 'VideoObject';
    } else if (typeSlug === 'blog-post') {
      schemaType = 'BlogPosting';
    } else if (typeSlug === 'static-page') {
      schemaType = 'WebPage';
    }
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": schemaType,
      "headline": item.title,
      "description": description,
      "url": resolvedCanonicalUrl,
      "datePublished": item.date_published,
      "dateModified": item.date_modified || item.date_published,
      "inLanguage": siteSeo.language || jsonData.language || 'en',
      ...(ogImage ? {"image": [ogImage]} : {}),
      ...(jsonData.authors && jsonData.authors.length > 0 ? {
        "author": jsonData.authors.map((author) => ({
          "@type": "Person",
          "name": author.name,
        })),
      } : {}),
      ...(siteSeo.site_name ? {
        "publisher": {
          "@type": "Organization",
          "name": siteSeo.site_name,
          ...(siteSeo.logo_url ? {
            "logo": {
              "@type": "ImageObject",
              "url": siteSeo.logo_url,
            },
          } : {}),
        },
      } : {}),
    };
    if (schemaType === 'VideoObject' && firstAttachment && firstAttachment.url) {
      jsonLd.contentUrl = firstAttachment.url;
    }
    if (schemaType === 'PodcastEpisode' && item._microfeed && item._microfeed['itunes:series']) {
      jsonLd.partOfSeries = {
        "@type": "CreativeWorkSeries",
        "name": item._microfeed['itunes:series'],
      };
    }
    return (
      <html lang={jsonData.language || 'en'}>
      <HtmlHeader
        title={title}
        description={description}
        webpackJsList={[]}
        webpackCssList={[]}
        canonicalUrl={resolvedCanonicalUrl}
        og={og}
        twitter={twitter}
        robots={robots}
        jsonLd={jsonLd}
        favicon={{
          // 'apple-touch-icon': '/assets/apple-touch-icon.png',
          // '32x32': '/assets/favicon-32x32.png',
          // '16x16': '/assets/favicon-16x16.png',
          // 'manifest': '/assets/site.webmanifest',
          // 'mask-icon': {
          //   'href': '/assets/safari-pinned-tab.svg',
          //   'color': '#b82f00',
          // },
          // 'msapplication-TileColor': '#da532c',
          // 'theme-color': '#ffffff',
        }}
      />
      <body>
        <div dangerouslySetInnerHTML={{__html: html}} />
      </body>
      </html>
    );
  }
}
