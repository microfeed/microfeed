import React from 'react';
import HtmlHeader from "../components/HtmlHeader";
import {htmlMetaDescription} from "../../common-src/StringUtils";

export default class EdgeHomeApp extends React.Component {
  render() {
    const {jsonData, theme} = this.props;
    const { html } = theme.getWebFeed();
    const siteSeo = (jsonData._microfeed && jsonData._microfeed.site_seo) ? jsonData._microfeed.site_seo : {};
    const title = siteSeo.default_title || jsonData.title;
    const description = siteSeo.default_description ||
      htmlMetaDescription(jsonData._microfeed.description_text, false);
    const canonicalUrl = jsonData.home_page_url || jsonData._microfeed.base_url;
    const ogImage = siteSeo.default_og_image || jsonData.icon;
    const og = {
      title,
      description,
      image: ogImage,
      type: 'website',
      url: canonicalUrl,
      siteName: siteSeo.site_name || jsonData.title,
    };
    const twitter = {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      image: ogImage,
      site: siteSeo.twitter_handle || '',
    };
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": siteSeo.site_name || jsonData.title,
      "url": canonicalUrl,
      "description": description,
      "inLanguage": siteSeo.language || jsonData.language || 'en',
    };
    return (
      <html lang={jsonData.language || 'en'}>
      <HtmlHeader
        title={title}
        description={description}
        webpackJsList={[]}
        webpackCssList={[]}
        canonicalUrl={canonicalUrl}
        og={og}
        twitter={twitter}
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
      <div id="client-side-root"/>
      </body>
      </html>
    );
  }
}
