import React from 'react';
import SubscribeSection from "../SubscribeSection";

export default function HeaderSection({ jsonData }){
  const {title, image, publisher} = jsonData.podcast;
  return (<div>
    <div className="mb-8">
      <h1 className="font-bold text-2xl md:text-4xl">{title}</h1>
    </div>
    <div className="flex">
      <div className="flex-none">
        <img src={image} className="lh-podcast-image" />
      </div>
      <div className="flex-1 ml-4">
        <div className="mt-2 md:mt-4 mb-4 md:mb-8">
          By <span className="font-semibold text-xl">{publisher}</span>
        </div>
        <div>
          <SubscribeSection jsonData={jsonData} />
        </div>
      </div>
    </div>
  </div>);
}
