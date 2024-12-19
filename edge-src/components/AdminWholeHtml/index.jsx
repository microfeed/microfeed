import React from 'react';
import HtmlHeader from "../HtmlHeader";
import {escapeHtml} from "../../../common-src/StringUtils";

export default class AdminWholeHtml extends React.Component {
  render() {
    const {
      title,
      description,
      webpackJsList,
      webpackCssList,
      feedContent,
      onboardingResult,
    } = this.props;
    return (
      <html>
      <HtmlHeader
        title={title}
        description={description}
        webpackJsList={webpackJsList}
        webpackCssList={webpackCssList}
        favicon={{
          'apple-touch-icon': '/assets/favicon/apple-touch-icon.png',
          '32x32': '/assets/favicon/favicon-32x32.png',
          '16x16': '/assets/favicon/favicon-16x16.png',
          'manifest': '/assets/favicon/site.webmanifest',
          'mask-icon': {
            'href': '/assets/favicon/safari-pinned-tab.svg',
            'color': '#5bbad5',
          },
          'msapplication-TileColor': '#2c2b3d',
          'theme-color': '#2c2b3d',
        }}
      />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/combine/npm/skeleton-css@2/css/normalize.css,npm/skeleton-css@2/css/skeleton.css">
      <body>
      <div id="client-side-root"/>
      {this.props.children}
      {feedContent && <script
        id="feed-content"
        type="application/json"
        dangerouslySetInnerHTML={{__html: escapeHtml(JSON.stringify(feedContent))}}
      />}
      {onboardingResult && <script
        id="onboarding-result"
        type="application/json"
        dangerouslySetInnerHTML={{__html: escapeHtml(JSON.stringify(onboardingResult))}}
      />}
      </body>
      </html>
    );
  }
}
