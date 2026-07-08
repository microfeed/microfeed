import React from "react";
import {resolveRecordPage} from "../../../edge-src/web/resolveRecordPage";
import PodcastEpisodePage from "../../../edge-src/web/PodcastEpisodePage";
import {renderReactToHtml} from "../../../edge-src/common/PageUtils";

export async function onRequestGet({params, env, request}) {
  const {slug} = params;

  const resolved = await resolveRecordPage(env, request, "podcast_episode", slug);
  if (!resolved) {
    return new Response("Not Found", {status: 404, statusText: "Not Found"});
  }

  const urlObject = new URL(request.url);
  const canonicalUrl = `${urlObject.origin}/i/${slug}/`;

  const html = renderReactToHtml(
    <PodcastEpisodePage
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
