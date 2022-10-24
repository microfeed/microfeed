import React from 'react';
import {Helmet} from "react-helmet";
import ReactDOMServer from "react-dom/server";

const webpackStats = require("../../../functions/webpack-stats.json");

/*

  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png">
  <link rel="manifest" href="/assets/site.webmanifest">
  <link rel="mask-icon" href="/assets/safari-pinned-tab.svg" color="#b82f00">
  <meta name="msapplication-TileColor" content="#da532c">
  <meta name="theme-color" content="#ffffff">
 */
class _HtmlHeader extends React.Component {
  getWebpackRealUrl(key) {
    try {
      return webpackStats.assets[webpackStats.chunks[key][0]].publicPath;
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  FaviconComponent({ favicon }) {
    return (<Helmet>
      {favicon['apple-touch-icon'] && <link
        rel="apple-touch-icon"
        sizes="180x180"
        href={favicon['apple-touch-icon']}
      />}
      {favicon['32x32'] && <link
        rel="icon"
        type="image/png"
        sizes="32x32"
        href={favicon['32x32']}
      />}
      {favicon['16x16'] && <link
        rel="icon"
        type="image/png"
        sizes="16x16"
        href={favicon['16x16']}
      />}
      {favicon['manifest'] && <link
        rel="manifest"
        href={favicon['manifest']}
      />}
      {favicon['theme-color'] && <meta
        name="theme-color"
        content={favicon['theme-color']}
      />}
      {favicon['msapplication-TileColor'] && <meta
        name="msapplication-TileColor"
        content={favicon['msapplication-TileColor']}
      />}
      {favicon['mask-icon'] && favicon['mask-icon'].href && favicon['mask-icon'].color && <link
        rel="mask-icon"
        href={favicon['mask-icon'].href}
        color={favicon['mask-icon'].color}
      />}
    </Helmet>);
  }

  render() {
    const {
      title,
      description,
      webpackJsList,
      webpackCssList,
      favicon,
    } = this.props;
    return (
      <div>
        <Helmet>
          <meta charSet="utf-8"/>
          <title>{title}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          {description && <meta name="description" content={description}/>}
          {webpackJsList && webpackJsList.length > 0 && webpackJsList.map((js) => {
            const realUrl = this.getWebpackRealUrl(js);
            console.log(js);
            return (realUrl ? <script key={js} type="text/javascript" src={realUrl} defer/> : '');
          })}
          {webpackCssList && webpackCssList.length > 0 && webpackCssList.map((css) => {
            const realUrl = this.getWebpackRealUrl(css);
            return (realUrl ? <link key={css} rel="stylesheet" type="text/css" href={realUrl}/> : '');
          })}
        </Helmet>
        {favicon && <this.FaviconComponent favicon={favicon} />}
      </div>
    );
  }
}

export default function HtmlHeader({title, description, webpackJsList, webpackCssList, favicon}) {
  ReactDOMServer.renderToString(<_HtmlHeader
    title={title}
    description={description}
    webpackJsList={webpackJsList}
    webpackCssList={webpackCssList}
    favicon={favicon}
  />);
  const helmet = Helmet.renderStatic();
  return (<head>
    {helmet.title.toComponent()}
    {helmet.meta.toComponent()}
    {helmet.link.toComponent()}
    {helmet.script.toComponent()}
  </head>);
}
