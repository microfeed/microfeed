import React from 'react';
import {msToDatetimeLocalString} from "../../../../common-src/TimeUtils";

export default function HeaderSection({ feed, episode }){
  console.log(feed);
  return (<div>
    <div className="mb-4">
      <a href="/">
        <div className="lh-icon-arrow-left">{feed.podcast.title}</div>
      </a>
    </div>
    <div>
      <h1 className="font-bold text-2xl md:text-4xl">{episode.title}</h1>
      <div className="mt-4">
        <time>{msToDatetimeLocalString(episode.pubDateMs)}</time>
      </div>
    </div>
  </div>);
}
