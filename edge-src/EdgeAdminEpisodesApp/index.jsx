import React from 'react';
import HtmlHeader from "../components/HtmlHeader";

export default class AdminEpisodesApp extends React.Component {
  render() {
    return (
      <html>
      <HtmlHeader
        title="Episodes | Admin"
        description=""
        webpackJsList={['admin_js']}
        webpackCssList={['admin_styles_css']}
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
      </body>
      </html>
    );
  }
}
