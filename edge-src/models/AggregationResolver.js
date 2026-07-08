import {STATUSES} from "../../common-src/Constants";
import ItemRepo from "./ItemRepo";
import RelationRepo, {GALLERY_MEMBER, RELATED_CONTENT} from "./RelationRepo";
import {listTypes} from "../registry/ContentTypeRegistry";

function recordTypeNames() {
  return listTypes().filter((type) => type.family === "record").map((type) => type.name);
}

function nonHomeTypeNames() {
  return listTypes().map((type) => type.name).filter((typeName) => typeName !== "home_page");
}

export default class AggregationResolver {
  constructor(db) {
    this.db = db;
    this.itemRepo = new ItemRepo(db);
    this.relationRepo = new RelationRepo(db);
  }

  async _resolveGallery(itemRow, statuses) {
    const memberIds = await this.relationRepo.getMemberIds(itemRow.id, GALLERY_MEMBER);
    if (memberIds.length === 0) {
      return [];
    }

    const response = await this.itemRepo.list({
      queryKwargs: {
        id__in: memberIds,
      },
    });
    const byId = new Map(response.results.map((row) => [row.id, row]));

    return memberIds
      .map((id) => byId.get(id))
      .filter((row) => row !== undefined && statuses.includes(row.status));
  }

  async _candidateIdsForTags(tagIds) {
    const placeholders = tagIds.map(() => "?").join(", ");
    const response = await this.db.prepare(
      `SELECT DISTINCT item_id FROM item_tags WHERE tag_id IN (${placeholders})`,
    ).bind(...tagIds).all();
    return response.results.map((row) => row.item_id);
  }

  async _resolveLandingPage(itemRow, statuses, data) {
    const contentTypes = Array.isArray(data.content_types) && data.content_types.length > 0
      ? data.content_types
      : recordTypeNames();
    const filterTags = Array.isArray(data.filter_tags) ? data.filter_tags : [];
    const sort = data.sort === "oldest_first" ? "oldest_first" : "newest_first";
    const limit = data.limit;

    const queryKwargs = {
      content_type__in: contentTypes,
      status__in: statuses,
    };

    if (filterTags.length > 0) {
      const candidateIds = await this._candidateIdsForTags(filterTags);
      if (candidateIds.length === 0) {
        return [];
      }
      queryKwargs.id__in = candidateIds;
    }

    const orderBy = sort === "newest_first"
      ? ["pub_date desc", "id"]
      : ["pub_date", "id"];

    const listOptions = {queryKwargs, orderBy};
    if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
      listOptions.limit = limit;
    }

    const response = await this.itemRepo.list(listOptions);
    return response.results;
  }

  async _resolveRelatedContent(itemRow, statuses) {
    const relatedIds = await this.relationRepo.getRelatedItemIds(itemRow.id, RELATED_CONTENT);
    if (relatedIds.length === 0) {
      return [];
    }

    const response = await this.itemRepo.list({
      queryKwargs: {
        id__in: relatedIds,
        status__in: statuses,
        content_type__in: nonHomeTypeNames(),
      },
      orderBy: ["updated_at desc", "id"],
      limit: 3,
    });
    return response.results;
  }

  async resolve(itemRow, {statuses = [STATUSES.PUBLISHED]} = {}) {
    const data = itemRow.data ? JSON.parse(itemRow.data) : {};

    if (itemRow.content_type === "gallery") {
      return this._resolveGallery(itemRow, statuses);
    }

    if (itemRow.content_type === "landing_page") {
      return this._resolveLandingPage(itemRow, statuses, data);
    }

    return [];
  }

  async resolveRelated(itemRow, {statuses = [STATUSES.PUBLISHED]} = {}) {
    return this._resolveRelatedContent(itemRow, statuses);
  }

  /**
   * Resolve a landing-style filter config without a saved landing_page row.
   * filterConfig = {content_types, filter_tags, sort, limit}.
   */
  async resolveFilter(filterConfig, {statuses = [STATUSES.PUBLISHED]} = {}) {
    const syntheticRow = {
      content_type: "landing_page",
      data: JSON.stringify(filterConfig || {}),
    };
    return this._resolveLandingPage(syntheticRow, statuses, filterConfig || {});
  }
}
