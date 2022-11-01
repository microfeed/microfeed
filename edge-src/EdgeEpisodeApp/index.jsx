import React from 'react';
import HtmlHeader from "../components/HtmlHeader";
import HeaderSection from './components/HeaderSection';
import AboutSection from './components/AboutSection';
import SubscribeSection from "../EdgeHomeApp/components/SubscribeSection";

export default class EdgeEpisodeApp extends React.Component {
  render() {
    const {episode, feed} = this.props;
    return (
      <html>
      <HtmlHeader
        title={episode.title}
        description={episode.description}
        webpackJsList={[]}
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
          <HeaderSection feed={feed} episode={episode}/>

          <div>
            <div className="hidden md:block text-gray-500 text-sm mb-4">
              Listen:
            </div>
            <audio controls preload="metadata" className="w-full">
              <source src={episode.audio} type={episode.audioFileType}/>
              Your browser does not support the audio element.
            </audio>
          </div>
          <div>
            <SubscribeSection/>
          </div>
          <AboutSection episode={episode}/>
        </div>
        <div className="hidden lg:block lg:col-span-2 xl:col-span-3"/>
      </div>
      </body>
      </html>
    );
  }
}
