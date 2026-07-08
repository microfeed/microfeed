import BaseRepo from "./BaseRepo";

const MEDIA_COLUMNS = [
  "id",
  "r2_key",
  "url",
  "title",
  "slug",
  "original_filename",
  "content_hash",
  "size",
  "content_type",
  "category",
  "width",
  "height",
  "created_at",
  "updated_at",
];

export default class MediaRepo extends BaseRepo {
  constructor(db) {
    super(db, {
      table: "media",
      primaryKey: "id",
      allowedColumns: MEDIA_COLUMNS,
    });
  }

  async getByContentHash(contentHash) {
    if (!contentHash) {
      return null;
    }
    return this.getFirst({
      queryKwargs: {
        content_hash: contentHash,
      },
    });
  }

  async getByR2Key(r2Key) {
    if (!r2Key) {
      return null;
    }
    return this.getFirst({
      queryKwargs: {
        r2_key: r2Key,
      },
    });
  }

  async getBySlug(slug) {
    if (!slug) {
      return null;
    }
    return this.getFirst({
      queryKwargs: {
        slug,
      },
    });
  }

  async listAll() {
    return this.list({
      orderBy: ["created_at desc", "id"],
    });
  }

  /**
   * Simple page-number pagination ordered by created_at desc. The shared
   * Paginator is hard-coupled to items' `pub_date` cursor column and the
   * QueryBuilder has no OFFSET support, so media — which has no pub_date —
   * loads the (bounded, admin-only) inventory and slices in JS instead.
   */
  async listPaginated({page = 1, limit = 50} = {}) {
    const safeLimit = Math.max(1, limit);
    const safePage = Math.max(1, page);
    const response = await this.listAll();
    const rows = response.results || [];
    const start = (safePage - 1) * safeLimit;
    const pageRows = rows.slice(start, start + safeLimit);
    return {
      results: pageRows,
      page: safePage,
      limit: safeLimit,
      total: rows.length,
      hasMore: start + safeLimit < rows.length,
    };
  }
}

export {MEDIA_COLUMNS};
