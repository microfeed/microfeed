import React from 'react';
// import HeaderSection from './components/HeaderSection';
// import AboutSection from './components/AboutSection';
// import EpisodeListSection from "./components/EpisodeListSection";
import HtmlHeader from "../components/HtmlHeader";
import {PUBLIC_URLS} from "../../common-src/StringUtils";
import {humanizeMs} from "../common/TimeUtils";
import {convert} from "html-to-text";

const Mustache = require('mustache');
const FEED_WEB = require('../common/default_themes/feed_web.html');

function episodeUrl() {
  return PUBLIC_URLS.pageEpisode(this.id, this.title);
}

function pubDate() {
  return humanizeMs(this.pubDateMs);
}

function descriptionText() {
  return convert(this.description, {});
}

export default class EdgeHomeApp extends React.Component {
  render() {
    const {jsonData} = this.props;
    const {podcast, episodes} = jsonData;
    const html = Mustache.render(FEED_WEB, {
      podcast,
      episodes,
      episodeUrl,
      pubDate,
      descriptionText,
    });
    return (
      <html>
      <HtmlHeader
        title={jsonData.podcast.title}
        description={jsonData.podcast.description}
        webpackJsList={['index_js']}
        webpackCssList={['']}
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
      {/*<div className="grid grid-cols-12 py-12">*/}
      {/*  <div className="hidden lg:block lg:col-span-2 xl:col-span-3"/>*/}
      {/*  <div className="col-span-12 lg:col-span-8 xl:col-span-6 px-4 grid grid-cols-1 gap-8">*/}
      {/*    <HeaderSection jsonData={jsonData}/>*/}
      {/*    <AboutSection jsonData={jsonData}/>*/}
      {/*    <EpisodeListSection jsonData={jsonData}/>*/}
      {/*  </div>*/}
      {/*  <div className="hidden lg:block lg:col-span-2 xl:col-span-3"/>*/}
      {/*</div>*/}
      <div id="client-side-root"/>
      </body>
      </html>
    );
  }
}
