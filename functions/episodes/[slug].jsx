import ReactDOMServer from "react-dom/server";
import EdgeEpisodeApp from "../../edge-src/EdgeEpisodeApp";
import React from "react";
import Feed from "../../edge-src/models/Feed";

export async function onRequestGet({params, env}) {
  const {slug} = params;
  const re = /^.+-([\d\w\-_]{11})$/;
  const ok = re.exec(slug);
  if (ok) {
    const episodeId = ok[1];
    if (episodeId) {
      const feed = new Feed(env);
      const content = await feed.getContent();
      const episode = content.episodes[episodeId];
      if (episode) {
        const fromReact = ReactDOMServer.renderToString(<EdgeEpisodeApp episode={episode} feed={content}/>);
        return new Response(fromReact, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        });
      }
    }
  }
  return new Response('Not Found', {
    status: 404,
    statusText: 'Not Found',
  });
}
