import React from 'react';
import HtmlHeader from "../HtmlHeader";
import {escapeHtml} from "../../../common-src/StringUtils";

export default class AdminWholeHtml extends React.Component {
  render() {
    const {title, description, webpackJsList, webpackCssList, feedContent} = this.props;
    return (
      <html>
      <HtmlHeader
        title={title}
        description={description}
        webpackJsList={webpackJsList}
        webpackCssList={webpackCssList}
        favicon={{
          'apple-touch-icon': '/assets/apple-touch-icon.png',
          '32x32': '/assets/favicon-32x32.png',
          '16x16': '/assets/favicon-16x16.png',
          'manifest': '/assets/site.webmanifest',
          'mask-icon': {
            'href': '/assets/safari-pinned-tab.svg',
            'color': '#b82f00',
          },
          'msapplication-TileColor': '#da532c',
          'theme-color': '#ffffff',
        }}
      />
      <body>
      <div id="client-side-root"/>
      {this.props.children}
      {feedContent && <script
        id="feed-content"
        type="application/json"
        dangerouslySetInnerHTML={{__html: escapeHtml(JSON.stringify(feedContent))}}
      />}
      </body>
      </html>
    );
  }
}
