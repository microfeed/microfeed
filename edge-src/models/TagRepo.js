import BaseRepo from "./BaseRepo";

const TAG_COLUMNS = [
  "id",
  "slug",
  "name",
  "created_at",
  "updated_at",
];

export default class TagRepo extends BaseRepo {
  constructor(db) {
    super(db, {
      table: "tags",
      primaryKey: "id",
      allowedColumns: TAG_COLUMNS,
    });
  }

  async getBySlug(slug) {
    return this.getFirst({
      queryKwargs: {
        slug,
      },
    });
  }
}

export {TAG_COLUMNS};
