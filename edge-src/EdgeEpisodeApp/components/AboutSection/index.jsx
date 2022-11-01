import React from 'react';

export default function AboutSection({ episode }){
  const {description, image} = episode;
  return (<div>
    <h2 className="lh-section-header">About</h2>
    <div className="grid grid-cols-1 gap-4">
    {image && <div>
      <img src={image} width={250} height={250}/>
    </div>}
    {description && <div dangerouslySetInnerHTML={{__html: description}} />}
    </div>
  </div>);
}
