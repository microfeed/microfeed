import React from "react";
import EdgeEpisodeApp from "../../edge-src/EdgeEpisodeApp";
import {WebResponseBuilder} from '../../edge-src/common/PublicPageUtils';

export async function onRequestGet({params, env}) {
  const {slug} = params;
  const re = /^.+-([\d\w\-_]{11})$/;
  const ok = re.exec(slug);
  if (ok) {
    const episodeId = ok[1];
    if (episodeId) {
      const webResponseBuilder = new WebResponseBuilder(env);
      return webResponseBuilder.getResponse({
        getComponent: (content, jsonData, theme) => {
          const episode = content.episodes[episodeId];
          return <EdgeEpisodeApp episode={episode} theme={theme}/>;
        },
      });
    }
  }
  return WebResponseBuilder.Response404();
}
