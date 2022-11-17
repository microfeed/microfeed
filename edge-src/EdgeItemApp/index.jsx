import React from 'react';
import HtmlHeader from "../components/HtmlHeader";

export default class EdgeItemApp extends React.Component {
  render() {
    const {item, theme} = this.props;
    const {html} = theme.getItemWeb(item);
    return (
      <html>
      <HtmlHeader
        title={item.title}
        description={item.description}
        webpackJsList={[]}
        webpackCssList={[]}
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
        <div dangerouslySetInnerHTML={{__html: html}} />
      </body>
      </html>
    );
  }
}
