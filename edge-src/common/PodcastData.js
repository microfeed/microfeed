const {ClientForWorkers} = require('podcast-api');

export default class PodcastData {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async getData() {
    const client = ClientForWorkers({
      apiKey: this.apiKey || null,
    });
    const response = await client.fetchPlaylistById({
      id: 'dummy-id',
    })
    response.data.creator = 'Wenbin Fang'
    response.data.items = response.data.items.filter((item) => item.data.status !== 'deleted');
    return response.data;
  }

  static humanizeMs(ms) {
     const date = new Date(ms);
     return date.toString('MMM dd');
  }
}
