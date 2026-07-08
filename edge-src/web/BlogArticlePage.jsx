import React from "react";
import RecordPageLayout from "./RecordPageLayout";
import {htmlMetaDescription} from "../../common-src/StringUtils";
import {humanizeMs} from "../../common-src/TimeUtils";

export default function BlogArticlePage({item, canonicalUrl, channel, navTypes, seo, relatedItems = []}) {
  const description = htmlMetaDescription(item.content_html || item.excerpt || "", !!item.content_html);
  const tags = item.tags || [];

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
      <p className="record-page__meta">
        {item.author && <span>{item.author}</span>}
        {item.author && item.date_published_ms !== undefined && <span> &middot; </span>}
        {item.date_published_ms !== undefined && <span>{humanizeMs(item.date_published_ms)}</span>}
      </p>
      {item.content_html && (
        <div className="record-page__body" dangerouslySetInnerHTML={{__html: item.content_html}} />
      )}
      {tags.length > 0 && (
        <ul className="record-page__tags">
          {tags.map((tag) => <li key={tag}>{tag}</li>)}
        </ul>
      )}
    </RecordPageLayout>
  );
}
