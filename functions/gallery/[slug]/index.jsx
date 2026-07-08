import React from "react";
import {resolveAggregatorPage} from "../../../edge-src/web/resolveAggregatorPage";
import GalleryPage from "../../../edge-src/web/GalleryPage";
import {renderReactToHtml} from "../../../edge-src/common/PageUtils";

export async function onRequestGet({params, env, request}) {
  const {slug} = params;

  const resolved = await resolveAggregatorPage(env, request, "gallery", slug);
  if (!resolved) {
    return new Response("Not Found", {status: 404, statusText: "Not Found"});
  }

  const urlObject = new URL(request.url);
  const canonicalUrl = `${urlObject.origin}/gallery/${slug}/`;

  const html = renderReactToHtml(
    <GalleryPage
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
