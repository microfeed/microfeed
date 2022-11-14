import React from "react";
import EdgeItemApp from "../../edge-src/EdgeItemApp";
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
          return <EdgeItemApp episode={episode} theme={theme}/>;
        },
      });
    }
  }
  return WebResponseBuilder.Response404();
}
