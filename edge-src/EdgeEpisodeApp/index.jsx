import React from 'react';
import HtmlHeader from "../components/HtmlHeader";

export default class EdgeEpisodeApp extends React.Component {
  render() {
    const {episode, theme} = this.props;
    const {html} = theme.getEpisodeWeb(episode);
    return (
      <html>
      <HtmlHeader
        title={episode.title}
        description={episode.description}
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
