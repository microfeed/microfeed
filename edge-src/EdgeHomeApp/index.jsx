import React from 'react';
import HeaderSection from './components/HeaderSection';
import AboutSection from './components/AboutSection';
import EpisodeListSection from "./components/EpisodeListSection";
import HtmlHeader from "../components/HtmlHeader";

export default class EdgeHomeApp extends React.Component {
  render() {
    const {jsonData} = this.props;
    return (
      <html>
      <HtmlHeader
        title={jsonData.podcast.name}
        description={jsonData.podcast.description}
        webpackJsList={['index_js']}
        webpackCssList={['public_default_css']}
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
      <div className="grid grid-cols-12 py-12">
        <div className="hidden lg:block lg:col-span-2 xl:col-span-3"/>
        <div className="col-span-12 lg:col-span-8 xl:col-span-6 px-4 grid grid-cols-1 gap-8">
          <HeaderSection jsonData={jsonData}/>
          <AboutSection jsonData={jsonData}/>
          <EpisodeListSection jsonData={jsonData}/>
        </div>
        <div className="hidden lg:block lg:col-span-2 xl:col-span-3"/>
      </div>
      <div id="client-side-root"/>
      </body>
      </html>
    );
  }
}
