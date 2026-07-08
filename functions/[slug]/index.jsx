import React from "react";
import {resolveAggregatorPage} from "../../edge-src/web/resolveAggregatorPage";
import LandingPage from "../../edge-src/web/LandingPage";
import {renderReactToHtml} from "../../edge-src/common/PageUtils";

// Root catch-all for landing_page items. Cloudflare Pages matches more
// specific routes (e.g. /blog/[slug], /admin/*, /api/*) before this root
// catch-all, so it only ever sees unmatched root-level slugs.
export async function onRequestGet({params, env, request}) {
  const {slug} = params;

  const resolved = await resolveAggregatorPage(env, request, "landing_page", slug);
  if (!resolved) {
    return new Response("Not Found", {status: 404, statusText: "Not Found"});
  }

  const urlObject = new URL(request.url);
  const canonicalUrl = `${urlObject.origin}/${slug}/`;

  const html = renderReactToHtml(
    <LandingPage
      item={resolved.item}
      members={resolved.members}
      relatedItems={resolved.relatedItems}
      canonicalUrl={canonicalUrl}
      channel={resolved.channel}
      navTypes={resolved.navTypes}
      seo={resolved.seo}
    />,
  );
  return new Response(html, {
    headers: {"content-type": "text/html; charset=utf-8"},
  });
}
