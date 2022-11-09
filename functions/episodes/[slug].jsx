import React from "react";
import EdgeEpisodeApp from "../../edge-src/EdgeEpisodeApp";
import {getResponseForPage} from '../../edge-src/common/PublicPageUtils';

export async function onRequestGet({params, env}) {
  const {slug} = params;
  const re = /^.+-([\d\w\-_]{11})$/;
  const ok = re.exec(slug);
  if (ok) {
    const episodeId = ok[1];
    if (episodeId) {
      return await getResponseForPage(async (feed, content, theme) => {
        const episode = content.episodes[episodeId];
        return <EdgeEpisodeApp episode={episode} theme={theme}/>;
      }, env);
    }
  }
  return new Response('Not Found', {
    status: 404,
    statusText: 'Not Found',
  });
}
