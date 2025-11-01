import React from 'react';

const webpackStats = require("../../../functions/webpack-stats.json");

export default class HtmlHeader extends React.Component {
  getWebpackRealUrl(key) {
    try {
      return webpackStats.assets[webpackStats.chunks[key][0]].publicPath;
    } catch (err) {
      return null;
    }
  }

  render() {
    const {
      title,
      description,
      webpackJsList,
      webpackCssList,
      favicon,
      canonicalUrl,
    } = this.props;
    return (
      <head>
        <meta charSet="utf-8"/>
        <title>{title}</title>
        {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        {description && <meta name="description" content={description}/>}
        {webpackJsList && webpackJsList.length > 0 && webpackJsList.map((js) => {
          const realUrl = this.getWebpackRealUrl(js);
          return (realUrl ? <script key={js} type="text/javascript" src={realUrl} defer/> : '');
        })}
        {webpackCssList && webpackCssList.length > 0 && webpackCssList.map((css) => {
          const realUrl = this.getWebpackRealUrl(css);
          return (realUrl ? <link key={css} rel="stylesheet" type="text/css" href={realUrl}/> : '');
        })}
        {favicon && favicon['apple-touch-icon'] && <link
          rel="apple-touch-icon"
          sizes="180x180"
          href={favicon['apple-touch-icon']}
        />}
        {favicon && favicon['32x32'] && <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href={favicon['32x32']}
        />}
        {favicon && favicon['16x16'] && <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href={favicon['16x16']}
        />}
        {favicon && favicon['manifest'] && <link
          rel="manifest"
          href={favicon['manifest']}
        />}
        {favicon && favicon['theme-color'] && <meta
          name="theme-color"
          content={favicon['theme-color']}
        />}
        {favicon && favicon['msapplication-TileColor'] && <meta
          name="msapplication-TileColor"
          content={favicon['msapplication-TileColor']}
        />}
        {favicon && favicon['mask-icon'] && favicon['mask-icon'].href && favicon['mask-icon'].color && <link
          rel="mask-icon"
          href={favicon['mask-icon'].href}
          color={favicon['mask-icon'].color}
        />}
      </head>
    );
  }
}
