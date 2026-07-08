import React from "react";

// Shared public nav bar rendered inside RecordPageLayout so every public
// page (home, record detail, aggregator, listing) inherits it. Brand links
// home via channel.image (fallback: channel.title text); type links come
// from the navTypes prop, computed once via publicNavTypes.getPublicNavTypes
// so the "which types have content" logic isn't duplicated per route.
export default function PublicNav({channel = {}, navTypes = []}) {
  const title = channel.title || "";
  // Always show a visible brand/home link, even before a channel title or logo
  // is configured, so the nav bar is never rendered empty/invisible.
  const brandText = title || "Home";

  return (
    <nav className="public-nav">
      <a className="public-nav__brand" href="/">
        {channel.image ? (
          <span className="public-nav__logo-box">
            <img className="public-nav__logo" src={channel.image} alt={brandText} />
          </span>
        ) : (
          <span className="public-nav__brand-text">{brandText}</span>
        )}
      </a>
      {navTypes.length > 0 && (
        <ul className="public-nav__links">
          {navTypes.map((entry) => (
            <li key={entry.name}>
              <a href={entry.href}>{entry.label}</a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
