import React from "react";
import {resolveRecordPage} from "../../../edge-src/web/resolveRecordPage";
import BlogArticlePage from "../../../edge-src/web/BlogArticlePage";
import {renderReactToHtml} from "../../../edge-src/common/PageUtils";

export async function onRequestGet({params, env, request}) {
  const {slug} = params;

  const resolved = await resolveRecordPage(env, request, "blog_article", slug);
  if (!resolved) {
    return new Response("Not Found", {status: 404, statusText: "Not Found"});
  }

  const urlObject = new URL(request.url);
  const canonicalUrl = `${urlObject.origin}/blog/${slug}/`;

  const html = renderReactToHtml(
    <BlogArticlePage
      item={resolved.item}
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
