import {ITEMS_SORT_ORDERS} from "../../common-src/Constants";
import BaseRepo from "./BaseRepo";
import {buildPaginationQuery, paginateRows} from "./Paginator";

const ITEM_COLUMNS = [
  "id",
  "status",
  "data",
  "content_type",
  "slug",
  "pub_date",
  "created_at",
  "updated_at",
];

export default class ItemRepo extends BaseRepo {
  constructor(db) {
    super(db, {
      table: "items",
      primaryKey: "id",
      allowedColumns: ITEM_COLUMNS,
    });
  }

  async getByTypeAndSlug(contentType, slug) {
    return this.getFirst({
      queryKwargs: {
        content_type: contentType,
        slug,
      },
    });
  }

  async listPaginated(options = {}) {
    const pageQuery = buildPaginationQuery(options);
    const response = await this.list(pageQuery);
    return paginateRows(response.results, pageQuery);
  }
}

export {ITEM_COLUMNS};
