import React from "react";
import RecordPageLayout from "./RecordPageLayout";
import ItemCard from "./ItemCard";
import {htmlMetaDescription} from "../../common-src/StringUtils";

function contentDescription(homePage, channel) {
  if (homePage && homePage.content_html) {
    return htmlMetaDescription(homePage.content_html, true);
  }
  return htmlMetaDescription(channel.description || "", false);
}

function renderCards(items, cardProps = {}) {
  return items.map((entry) => (
    <ItemCard key={`${entry.content_type}-${entry.slug}`} item={entry} {...cardProps} />
  ));
}

function sectionHasConfig(homePage, keys) {
  if (!homePage) {
    return false;
  }
  return keys.some((key) => {
    const value = homePage[key];
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value !== undefined && value !== null && value !== "";
  });
}

function HomePageSection({title, items, emptyText, cardProps = {}}) {
  return (
    <section className="home-page__section">
      <div className="home-page__section-header">
        <h2 className="home-page__section-title">{title}</h2>
      </div>
      {items.length > 0 ? (
        <div className="item-feed">{renderCards(items, cardProps)}</div>
      ) : (
        <p className="home-page__empty">{emptyText}</p>
      )}
    </section>
  );
}

function HomeChannelSummary({homePage, channel}) {
  const showTitle = homePage.show_channel_title === true;
  const showDescription = homePage.show_channel_description === true;
  const showImage = homePage.show_channel_image === true;

  if (!showTitle && !showDescription && !showImage) {
    return null;
  }

  return (
    <section className="home-page__channel-summary">
      {showImage && channel.image && (
        <img className="home-page__channel-image" src={channel.image} alt={channel.title || "Channel"} />
      )}
      <div className="home-page__channel-copy">
        {showTitle && channel.title && <h2 className="home-page__channel-title">{channel.title}</h2>}
        {showDescription && channel.description && (
          <p className="home-page__channel-description">{channel.description}</p>
        )}
      </div>
    </section>
  );
}

function HybridHomePage({
  channel,
  homePage,
  recentItems,
  featuredItems,
  filteredItems,
  canonicalUrl,
  navTypes,
  seo,
}) {
  const heroTitle = homePage.title || channel.title || "";
  const showRecentDate = homePage.recent_show_date === true;
  const showRecentExcerpt = homePage.recent_show_excerpt !== false;
  const showRecentBadge = homePage.recent_show_badge !== false;
  const showFeaturedSection = featuredItems.length > 0 || sectionHasConfig(homePage, ["featured_title", "featured_items"]);
  const showFilteredSection = filteredItems.length > 0 || sectionHasConfig(homePage, [
    "filtered_title",
    "content_types",
    "filter_tags",
    "sort",
    "limit",
  ]);

  return (
    <RecordPageLayout
      title={heroTitle}
      description={contentDescription(homePage, channel)}
      canonicalUrl={canonicalUrl}
      channel={channel}
      navTypes={navTypes}
      seo={seo}
    >
      <div className="home-page">
        <section className="home-hero">
          {homePage.image && <img className="home-hero__banner" src={homePage.image} alt={heroTitle} />}
          <div className="home-hero__copy">
            <h1 className="home-hero__title">{heroTitle}</h1>
            {homePage.content_html ? (
              <div
                className="home-hero__description"
                dangerouslySetInnerHTML={{__html: homePage.content_html}}
              />
            ) : channel.description ? (
              <p className="home-hero__description">{channel.description}</p>
            ) : null}
          </div>
        </section>

        <HomeChannelSummary homePage={homePage} channel={channel} />

        <HomePageSection
          title="Recent"
          items={recentItems}
          emptyText="No recent items yet."
          cardProps={{
            showDate: showRecentDate,
            showExcerpt: showRecentExcerpt,
            showBadge: showRecentBadge,
          }}
        />

        {showFeaturedSection && (
          <HomePageSection
            title={homePage.featured_title || "Featured"}
            items={featuredItems}
            emptyText="No featured items yet."
          />
        )}

        {showFilteredSection && (
          <HomePageSection
            title={homePage.filtered_title || "Filtered"}
            items={filteredItems}
            emptyText="No filtered items yet."
          />
        )}
      </div>
    </RecordPageLayout>
  );
}

export default function HomePage({
  channel,
  items,
  recentItems,
  homePage,
  featuredItems = [],
  filteredItems = [],
  canonicalUrl,
  navTypes,
  seo,
}) {
  const homePageData = homePage || null;
  const fallbackItems = items || [];
  const recentFeedItems = recentItems || fallbackItems;

  if (!homePageData) {
    return (
      <RecordPageLayout
        title={channel.title || ""}
        description={contentDescription(null, channel)}
        canonicalUrl={canonicalUrl}
        channel={channel}
        navTypes={navTypes}
        seo={seo}
      >
        <div className="home-hero">
          {channel.image && <img className="home-hero__banner" src={channel.image} alt={channel.title || ""} />}
          <h1 className="home-hero__title">{channel.title || ""}</h1>
          {channel.description && <p className="home-hero__description">{channel.description}</p>}
        </div>
        <div className="item-feed">
          {renderCards(fallbackItems)}
        </div>
      </RecordPageLayout>
    );
  }

  return (
    <HybridHomePage
      channel={channel}
      homePage={homePageData}
      recentItems={recentFeedItems}
      featuredItems={featuredItems}
      filteredItems={filteredItems}
      canonicalUrl={canonicalUrl}
      navTypes={navTypes}
      seo={seo}
    />
  );
}
