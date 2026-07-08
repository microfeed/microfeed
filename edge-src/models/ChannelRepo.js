import {STATUSES} from "../../common-src/Constants";
import BaseRepo from "./BaseRepo";

const CHANNEL_COLUMNS = [
  "id",
  "status",
  "is_primary",
  "data",
  "created_at",
  "updated_at",
];

export default class ChannelRepo extends BaseRepo {
  constructor(db) {
    super(db, {
      table: "channels",
      primaryKey: "id",
      allowedColumns: CHANNEL_COLUMNS,
    });
  }

  async getPrimaryPublished() {
    return this.getFirst({
      queryKwargs: {
        status: STATUSES.PUBLISHED,
        is_primary: 1,
      },
    });
  }
}

export {CHANNEL_COLUMNS};
