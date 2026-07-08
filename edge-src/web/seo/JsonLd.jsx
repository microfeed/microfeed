import React from "react";

/**
 * Renders JSON-LD from seo.jsonLd (the primary entity) plus, when present,
 * seo.breadcrumb (a BreadcrumbList) as a SEPARATE <script> block. Emitting
 * multiple entities as independent ld+json scripts is Google-recommended and
 * avoids a redundant @graph that duplicates the primary node.
 *
 * No user HTML should ever be inside these values (descriptions are
 * pre-stripped via htmlMetaDescription), but as defense in depth against
 * script-tag breakout we still escape "</" to "<\/".
 */
function serialize(node) {
  return JSON.stringify(node).replace(/<\//g, "<\\/");
}

export default function JsonLd({seo}) {
  if (!seo || !seo.jsonLd) {
    return null;
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: serialize(seo.jsonLd)}} />
      {seo.breadcrumb && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html: serialize(seo.breadcrumb)}} />
      )}
    </>
  );
}
