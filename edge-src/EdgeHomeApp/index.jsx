import React from 'react';
import HeaderSection from './components/HeaderSection';
import SubscribeSection from "./components/SubscribeSection";
import AboutSection from './components/AboutSection';
import EpisodeListSection from "./components/EpisodeListSection";

export default class EdgeHomeApp extends React.Component {
  render() {
    const { jsonData } = this.props;
    return (
      <div className="grid grid-cols-12 py-12">
        <div className="hidden lg:block lg:col-span-2 xl:col-span-3" />
        <div className="col-span-12 lg:col-span-8 xl:col-span-6 px-4 grid grid-cols-1 gap-8">
          <HeaderSection jsonData={jsonData} />
          <AboutSection jsonData={jsonData} />
          <EpisodeListSection jsonData={jsonData} />
        </div>
      </div>
    );
  }
}
