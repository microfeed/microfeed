import React from "react";
import RecordPageLayout from "./RecordPageLayout";
import {htmlMetaDescription} from "../../common-src/StringUtils";
import {humanizeMs} from "../../common-src/TimeUtils";
import {ENCLOSURE_CATEGORIES} from "../../common-src/Constants";

export default function PodcastEpisodePage({item, canonicalUrl, channel, navTypes, seo, relatedItems = []}) {
  const description = htmlMetaDescription(item.content_html || "", true);
  const attachment = item.attachment;

  return (
    <RecordPageLayout
      title={item.title}
      description={description}
      canonicalUrl={canonicalUrl}
      channel={channel}
      navTypes={navTypes}
      seo={seo}
      relatedItems={relatedItems}
    >
      {item.image && <img className="record-page__cover" src={item.image} alt={item.title} />}
      <h1 className="record-page__title">{item.title}</h1>
      {item.date_published_ms !== undefined && (
        <p className="record-page__meta">{humanizeMs(item.date_published_ms)}</p>
      )}
      {attachment && attachment.category === ENCLOSURE_CATEGORIES.AUDIO && (
        <audio className="record-page__audio" controls src={attachment.url}>
          <a href={attachment.url}>Download audio</a>
        </audio>
      )}
      {attachment && attachment.category !== ENCLOSURE_CATEGORIES.AUDIO && (
        <p className="record-page__meta">
          <a href={attachment.url}>Listen / view episode attachment</a>
        </p>
      )}
      {item.content_html && (
        <div className="record-page__body" dangerouslySetInnerHTML={{__html: item.content_html}} />
      )}
    </RecordPageLayout>
  );
}
