import React from "react";
import RecordPageLayout from "./RecordPageLayout";
import {htmlMetaDescription} from "../../common-src/StringUtils";
import {itemPublicUrl} from "./itemPublicUrl";

export default function GalleryPage({item, members, canonicalUrl, channel, navTypes, seo, relatedItems = []}) {
  const description = htmlMetaDescription(item.content_html || "", true);
  const photos = members || [];

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
      <h1 className="record-page__title">{item.title}</h1>
      {item.content_html && (
        <div className="record-page__body" dangerouslySetInnerHTML={{__html: item.content_html}} />
      )}
      <div className="gallery-page__grid">
        {photos.map((photo) => (
          <a key={photo.slug} className="gallery-page__item" href={itemPublicUrl("photo", photo.slug)}>
            {photo.image && <img className="gallery-page__image" src={photo.image} alt={photo.title || photo.caption || ""} />}
            {(photo.title || photo.caption) && (
              <span className="gallery-page__caption">{photo.title || photo.caption}</span>
            )}
          </a>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .gallery-page__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 1rem;
          margin-top: 1.5rem;
        }
        .gallery-page__item {
          display: block;
          color: inherit;
          text-decoration: none;
        }
        .gallery-page__image {
          width: 100%;
          height: auto;
          border-radius: 6px;
          display: block;
        }
        .gallery-page__caption {
          display: block;
          margin-top: 0.4rem;
          font-size: 0.9rem;
          color: #666666;
        }
        @media (prefers-color-scheme: dark) {
          .gallery-page__caption {
            color: #a0a0a0;
          }
        }
      `}} />
    </RecordPageLayout>
  );
}
