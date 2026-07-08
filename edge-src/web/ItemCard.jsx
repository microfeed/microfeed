import React from "react";
import {itemPublicUrl} from "./itemPublicUrl";
import {humanizeMs} from "../../common-src/TimeUtils";

// Card badge labels (singular: "Blog" / "Photo" / "Podcast" per PRD 4.2).
// Distinct from the plural nav labels in publicNavTypes.js ("Blog" /
// "Photos" / "Podcast") which describe a whole listing/section, not one item.
const BADGE_LABELS = {
  blog_article: "Blog",
  photo: "Photo",
  podcast_episode: "Podcast",
  gallery: "Gallery",
};

function cardTitle(item) {
  return item.title || item.caption || item.excerpt || item.slug;
}

function cardExcerpt(item) {
  if (item.title && item.excerpt) {
    return item.excerpt;
  }
  if (item.title && item.caption) {
    return item.caption;
  }
  if (item.title) {
    return null;
  }
  return null;
}

// Shared card markup consumed by HomePage's feed and TypeListingPage, so
// card presentation lives in exactly one place (PRD 4.4).
export default function ItemCard({
  item,
  showDate = false,
  showExcerpt = true,
  showBadge = true,
}) {
  const href = itemPublicUrl(item.content_type, item.slug);
  const title = cardTitle(item);
  const excerpt = cardExcerpt(item);
  const badgeLabel = BADGE_LABELS[item.content_type] || item.content_type;

  return (
    <article className="item-card">
      <a className="item-card__link" href={href}>
        {item.image && (
          <div className="item-card__image-frame">
            <img className="item-card__image" src={item.image} alt={title || ""} />
          </div>
        )}
        {showBadge && <span className="item-card__badge">{badgeLabel}</span>}
        <h3 className="item-card__title">{title}</h3>
        {showDate && item.date_published_ms !== undefined && item.date_published_ms !== null && (
          <time className="item-card__meta" dateTime={new Date(item.date_published_ms).toISOString()}>
            {humanizeMs(item.date_published_ms)}
          </time>
        )}
        {showExcerpt && excerpt && <p className="item-card__excerpt">{excerpt}</p>}
      </a>
    </article>
  );
}
