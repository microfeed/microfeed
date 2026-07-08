import React from "react";
import {resolveTypeListingPage} from "../../edge-src/web/resolveTypeListingPage";
import TypeListingPage from "../../edge-src/web/TypeListingPage";
import {renderReactToHtml} from "../../edge-src/common/PageUtils";

export async function onRequestGet({env, request}) {
  const resolved = await resolveTypeListingPage(env, request, "photo", "Photos");

  const urlObject = new URL(request.url);
  const canonicalUrl = `${urlObject.origin}/photo/`;

  const html = renderReactToHtml(
    <TypeListingPage
      typeLabel="Photos"
      items={resolved.items}
      navTypes={resolved.navTypes}
      channel={resolved.channel}
      canonicalUrl={canonicalUrl}
      basePath="/photo/"
      nextCursor={resolved.nextCursor}
      prevCursor={resolved.prevCursor}
      seo={resolved.seo}
    />,
  );
  return new Response(html, {
    headers: {"content-type": "text/html; charset=utf-8"},
  });
}
