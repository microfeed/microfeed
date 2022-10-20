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
        <div className="mb-4 text-sm line-clamp-2">
          <span className="text-gray-500">{humanizeMs(data.pub_date_ms)}</span>
          <span dangerouslySetInnerHTML={{__html: '&middot;'}} className="mx-1" />
          <span>{descriptionText}</span>
        </div>
        <div className="flex items-center">
          <div>
            <img src="/assets/icons/play.svg" className="w-10" />
          </div>
          <div className="text-sm ml-4">
            {toHHMMSS(data.audio_length_sec)}
          </div>
        </div>
      </div>
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
