import React from 'react';
import { humanizeMs, toHHMMSS } from '../../../common/TimeUtils';
const { convert } = require('html-to-text');

function EpisodeItem({ item }) {
  const {data} = item;
  const descriptionText = convert(item.data.description, {});
  return (<div>
    <h3 className="font-semibold mb-3">
      {data.title}
    </h3>
    <div className="flex">
      <div className="mr-4 flex-none">
        <img src={data.image} className="lh-podcast-image lh-episode-image" />
      </div>
      <div className="flex-1">
        <div className="mb-4 text-sm line-clamp-3">
          <span className="text-gray-500">{humanizeMs(data.pub_date_ms)}</span>
          <span dangerouslySetInnerHTML={{__html: '&middot;'}} className="mx-1" />
          <span className="break-all">{descriptionText}</span>
        </div>
      </div>
    </div>
    <div className="mt-2">
      <audio controls preload="metadata" className="w-full">
        <source src={data.audio} type="audio/mpeg"/>
        Your browser does not support the audio element.
      </audio>
    </div>
  </div>);
}

export default function EpisodeListSection({jsonData}) {
  const {items} = jsonData;
  return (<div>
    <h2 className="lh-section-header">
      Recent episodes
    </h2>
    <div className="grid grid-cols-1 gap-6">
      {items.map((item) => <div key={`eps-${item.id}`}>
        <EpisodeItem item={item} />
      </div>)}
    </div>
  </div>);
}
