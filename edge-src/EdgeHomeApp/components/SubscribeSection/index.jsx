import React from 'react';
import {PUBLIC_URLS} from "../../../../common-src/StringUtils";

function SubscribeButton({brand, logoStyle, url}) {
  return (<a href={url} className="hover:opacity-50 mr-2 md:mr-4 mb-2">
    <div className="flex px-2 md:px-4 py-1 md:py-2 border rounded">
      <div className="flex items-center">
        <img src={`/assets/brands/${brand}.svg`} className={logoStyle}/>
      </div>
      <div className="ml-2 text-sm md:text-lg">{brand}</div>
    </div>
  </a>);
}

export default function SubscribeSection({jsonData}) {
  // const {name, thumbnail, creator} = jsonData;
  return (<div>
    <div className="hidden md:block text-gray-500 text-sm mb-4">
      Subscribe:
    </div>
    <div className="flex flex-wrap">
      <SubscribeButton brand="apple" logoStyle="w-3.5"/>
      <SubscribeButton brand="spotify" logoStyle="w-4"/>
      <SubscribeButton brand="rss" logoStyle="w-4" url={PUBLIC_URLS.feedRss()}/>
      <SubscribeButton brand="json" logoStyle="w-4" url={PUBLIC_URLS.feedJson()}/>
    </div>
  </div>);
}
