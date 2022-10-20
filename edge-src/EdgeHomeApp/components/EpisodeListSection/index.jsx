import React from 'react';

function EpisodeItem({ item }) {
  const {data} = item;
  return (<div>
    {data.title}
  </div>);
}

export default function EpisodeListSection({jsonData}) {
  const {items} = jsonData;
  return (<div>
    <h2 className="lh-section-header">
      Recent episodes
    </h2>
    <div>
      {items.map((item) => <div>
        <EpisodeItem item={item} />
      </div>)}
    </div>
  </div>);
}
