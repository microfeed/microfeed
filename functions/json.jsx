import PodcastData from '../edge-src/common/PodcastData';

export async function onRequestGet() {
  const podcastData = new PodcastData();
  return new Response(JSON.stringify(await podcastData.getData()), {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
  });
}
