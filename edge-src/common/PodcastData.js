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
    return response.data;
  }
}
