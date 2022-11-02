import React from 'react';

export default function AboutSection({ jsonData }){
  const {description} = jsonData.podcast;
  return (<div>
    <h2 className="lh-section-header">About</h2>
    <div dangerouslySetInnerHTML={{__html: description}} />
  </div>);
}
