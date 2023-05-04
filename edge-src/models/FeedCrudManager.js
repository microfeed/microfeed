import {randomShortUUID} from "../../common-src/StringUtils";

export default class FeedCrudManager {
  constructor(feedContent, feedDb, request) {
    this.feedContent = feedContent;
    this.feedDb = feedDb;
    this.request = request;
  }

  upsertItem(item) {
    const itemId = item.id ? item.id : randomShortUUID();
    this.feedContent.item = {
      // TODO: transform item from public jsonfeed to internal format
      ...item,
      id: itemId,
      guid: itemId,
    };
    this.feedDb.putContent(this.feedContent);
    return itemId;
  }
}
