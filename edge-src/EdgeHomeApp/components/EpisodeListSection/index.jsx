import React from 'react';
import { humanizeMs } from '../../../common/TimeUtils';
import {PUBLIC_URLS} from "../../../../common-src/StringUtils";

const { convert } = require('html-to-text');

function EpisodeItem({ episode }) {
  const descriptionText = convert(episode.description, {});
  return (<div>
    <h3 className="font-semibold mb-3">
      <a href={PUBLIC_URLS.pageEpisode(episode.id, episode.title)}>{episode.title}</a>
    </h3>
    <div className="flex">
      <div className="mr-4 flex-none">
        <img src={episode.image} className="lh-podcast-image lh-episode-image" />
      </div>
      <div className="flex-1">
        <div className="mb-4 text-sm line-clamp-3">
          <span className="text-gray-500">{humanizeMs(episode.pubDateMs)}</span>
          <span dangerouslySetInnerHTML={{__html: '&middot;'}} className="mx-1" />
          <span className="break-all">{descriptionText}</span>
        </div>
      </div>
    </div>
    <div className="mt-2">
      <audio controls preload="metadata" className="w-full">
        <source src={episode.audio} type="audio/mpeg"/>
        Your browser does not support the audio element.
      </audio>
    </div>
  </div>);
}

export default function EpisodeListSection({jsonData}) {
  const {episodes} = jsonData;
  return (<div>
    <h2 className="lh-section-header">
      Recent episodes
    </h2>
    <div className="grid grid-cols-1 gap-6">
      {episodes.map((eps) => <div key={`eps-${eps.id}`}>
        <EpisodeItem episode={eps} />
      </div>)}
    </div>
  </div>);
}
