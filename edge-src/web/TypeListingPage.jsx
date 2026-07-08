import React from "react";
import RecordPageLayout from "./RecordPageLayout";
import ItemCard from "./ItemCard";

function paginationHref(basePath, param, cursor) {
  return `${basePath}?${param}=${encodeURIComponent(cursor)}`;
}

export default function TypeListingPage({
  typeLabel,
  items,
  navTypes,
  channel,
  canonicalUrl,
  basePath = "",
  nextCursor,
  prevCursor,
  seo,
}) {
  const entries = items || [];

  return (
    <RecordPageLayout
      title={typeLabel}
      canonicalUrl={canonicalUrl}
      channel={channel}
      navTypes={navTypes}
      seo={seo}
    >
      <h1 className="record-page__title">{typeLabel}</h1>
      {entries.length === 0 ? (
        <p className="listing-page__empty">No items yet.</p>
      ) : (
        <div className="item-feed">
          {entries.map((entry) => (
            <ItemCard key={`${entry.content_type}-${entry.slug}`} item={entry} />
          ))}
        </div>
      )}
      {(prevCursor !== undefined || nextCursor !== undefined) && (
        <div className="listing-page__pagination">
          <span>
            {prevCursor !== undefined && (
              <a href={paginationHref(basePath, "prev_cursor", prevCursor)}>&larr; Previous</a>
            )}
          </span>
          <span>
            {nextCursor !== undefined && (
              <a href={paginationHref(basePath, "next_cursor", nextCursor)}>Next &rarr;</a>
            )}
          </span>
        </div>
      )}
    </RecordPageLayout>
  );
}
