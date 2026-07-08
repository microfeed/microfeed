import React from "react";
import RecordPageLayout from "./RecordPageLayout";
import {htmlMetaDescription} from "../../common-src/StringUtils";
import {itemPublicUrl} from "./itemPublicUrl";

function itemTitle(entry) {
  return entry.title || entry.caption || entry.excerpt || entry.slug;
}

export default function LandingPage({item, members, canonicalUrl, channel, navTypes, seo, relatedItems = []}) {
  const description = htmlMetaDescription(item.content_html || "", true);
  const entries = members || [];
  const layout = item.layout === "grid" ? "grid" : "list";
  const gridClass = layout === "grid" ? "landing-page__grid" : "landing-page__list";

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
      <ul className={gridClass}>
        {entries.map((entry) => (
          <li key={`${entry.content_type}-${entry.slug}`} className="landing-page__entry">
            <a href={itemPublicUrl(entry.content_type, entry.slug)}>
              {layout === "grid" && entry.image && (
                <img className="landing-page__image" src={entry.image} alt={itemTitle(entry)} />
              )}
              <span className="landing-page__entry-title">{itemTitle(entry)}</span>
            </a>
          </li>
        ))}
      </ul>
      <style dangerouslySetInnerHTML={{__html: `
        .landing-page__list {
          list-style: none;
          padding: 0;
          margin: 1.5rem 0 0;
        }
        .landing-page__list .landing-page__entry {
          padding: 0.75rem 0;
          border-bottom: 1px solid #e5e5e5;
        }
        .landing-page__list a {
          color: inherit;
          text-decoration: none;
          font-size: 1.1rem;
        }
        .landing-page__grid {
          list-style: none;
          padding: 0;
          margin: 1.5rem 0 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 1rem;
        }
        .landing-page__grid a {
          display: block;
          color: inherit;
          text-decoration: none;
        }
        .landing-page__image {
          width: 100%;
          height: auto;
          border-radius: 6px;
          display: block;
          margin-bottom: 0.4rem;
        }
        @media (prefers-color-scheme: dark) {
          .landing-page__list .landing-page__entry {
            border-bottom-color: #2a2a2a;
          }
        }
      `}} />
    </RecordPageLayout>
  );
}
