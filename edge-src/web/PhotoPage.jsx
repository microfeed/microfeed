import React from "react";
import RecordPageLayout from "./RecordPageLayout";
import {htmlMetaDescription} from "../../common-src/StringUtils";
import {humanizeMs} from "../../common-src/TimeUtils";

export default function PhotoPage({item, canonicalUrl, channel, navTypes, seo, relatedItems = []}) {
  const title = item.title || "Photo";
  const description = htmlMetaDescription(item.caption || "", false);
  const tags = item.tags || [];

  return (
    <RecordPageLayout
      title={title}
      description={description}
      canonicalUrl={canonicalUrl}
      channel={channel}
      navTypes={navTypes}
      seo={seo}
      relatedItems={relatedItems}
    >
      {item.image && <img className="record-page__cover" src={item.image} alt={title} />}
      {item.title && <h1 className="record-page__title">{item.title}</h1>}
      {item.caption && <p className="record-page__caption">{item.caption}</p>}
      {item.date_published_ms !== undefined && (
        <p className="record-page__meta">{humanizeMs(item.date_published_ms)}</p>
      )}
      {tags.length > 0 && (
        <ul className="record-page__tags">
          {tags.map((tag) => <li key={tag}>{tag}</li>)}
        </ul>
      )}
    </RecordPageLayout>
  );
}
