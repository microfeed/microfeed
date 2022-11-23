// import {projectPrefix} from "../../common-src/R2Utils";
import {randomShortUUID} from "../../common-src/StringUtils";

export default class FeedDb {
  constructor(env, request) {
    const {
      FEED_DB,
    } = env;
    this.FEED_DB = FEED_DB;
  }

  async initFeed() {
    const data = {
      "itunes:explicit": false,
      "itunes:block": false,
      "itunes:episodeType": "full",
      "title": "wfsafdsfsd",
      "link": "http://127.0.0.1:8788/i/wfsafdsfs-YJk4XRi5EMd/",
      "description": "<p>sdfasffdsf</p>",
      "mediaFile": {
        "url": 'https://media.wenbin.org/wenbinorg/production/media/document-b3bb242447c0b7cd3c54f452a833d92f.pdf',
      },
    };
    const batchStatements = []
    for (let i = 0; i < 100; i++) {
      batchStatements.push(
        this.FEED_DB.prepare(
          'INSERT INTO items (id, data, pub_date) VALUES (?1, ?2, ?3)')
          .bind(randomShortUUID(), JSON.stringify(data), (new Date()).toISOString())
      );
    }
    const res = await this.FEED_DB.batch(batchStatements);
    console.log(res);
    const queryRes = await this.FEED_DB.prepare("SELECT * FROM items").all();
    // console.log(results);
    console.log('query duration', queryRes.duration);
  }
}
