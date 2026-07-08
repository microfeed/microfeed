export default class TagLinkRepo {
  constructor(db) {
    this.db = db;
  }

  async setItemTags(itemId, tagIds = []) {
    const statements = [
      this.db.prepare("DELETE FROM item_tags WHERE item_id = ?").bind(itemId),
    ];

    tagIds.forEach((tagId) => {
      statements.push(
        this.db.prepare(
          "INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?) ON CONFLICT(item_id, tag_id) DO NOTHING",
        ).bind(itemId, tagId),
      );
    });

    return this.db.batch(statements);
  }

  async getTagIdsForItem(itemId) {
    const response = await this.db.prepare(
      "SELECT tag_id FROM item_tags WHERE item_id = ?",
    ).bind(itemId).all();
    return response.results.map((row) => row.tag_id);
  }

  async getItemIdsForTag(tagId) {
    const response = await this.db.prepare(
      "SELECT item_id FROM item_tags WHERE tag_id = ?",
    ).bind(tagId).all();
    return response.results.map((row) => row.item_id);
  }
}
