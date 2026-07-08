const GALLERY_MEMBER = "gallery_member";
const RELATED_CONTENT = "related_content";

function dedupeIds(ids, excludeId = null) {
  const uniqueIds = [];
  const seen = new Set();
  (ids || []).forEach((id) => {
    if (id === excludeId || seen.has(id)) {
      return;
    }
    seen.add(id);
    uniqueIds.push(id);
  });
  return uniqueIds;
}

export default class RelationRepo {
  constructor(db) {
    this.db = db;
  }

  async setMembers(parentId, childIds = [], relType = GALLERY_MEMBER) {
    const dedupedChildIds = dedupeIds(childIds);

    const statements = [
      this.db.prepare(
        "DELETE FROM item_relations WHERE parent_item_id = ? AND rel_type = ?",
      ).bind(parentId, relType),
    ];

    dedupedChildIds.forEach((childId, index) => {
      statements.push(
        this.db.prepare(
          "INSERT INTO item_relations (parent_item_id, child_item_id, rel_type, position) VALUES (?, ?, ?, ?)",
        ).bind(parentId, childId, relType, index),
      );
    });

    return this.db.batch(statements);
  }

  async getMemberIds(parentId, relType = GALLERY_MEMBER) {
    const response = await this.db.prepare(
      "SELECT child_item_id FROM item_relations WHERE parent_item_id = ? AND rel_type = ? ORDER BY position",
    ).bind(parentId, relType).all();
    return response.results.map((row) => row.child_item_id);
  }

  async getRelatedItemIds(itemId, relType = RELATED_CONTENT) {
    const outgoing = await this.db.prepare(
      "SELECT child_item_id AS related_item_id FROM item_relations WHERE parent_item_id = ? AND rel_type = ? ORDER BY position",
    ).bind(itemId, relType).all();
    const incoming = await this.db.prepare(
      "SELECT parent_item_id AS related_item_id FROM item_relations WHERE child_item_id = ? AND rel_type = ? ORDER BY position",
    ).bind(itemId, relType).all();

    return dedupeIds(
      [...outgoing.results, ...incoming.results].map((row) => row.related_item_id),
      itemId,
    );
  }
}

export {GALLERY_MEMBER, RELATED_CONTENT};
