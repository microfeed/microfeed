import FeedCrudManager from "./FeedCrudManager";
import TagLinkRepo from "./TagLinkRepo";
import RelationRepo from "./RelationRepo";
import {STATUSES} from "../../common-src/Constants";
import {randomShortUUID} from "../../common-src/StringUtils";
import {msToRFC3339, rfc3399ToMs} from "../../common-src/TimeUtils";
import {getFieldDefs, getType} from "../registry/ContentTypeRegistry";
import {mapItem, validateItem} from "../registry/itemMapper";
import {toPublic} from "../registry/fieldKinds";

const slugify = require("slugify");

function normalizePath(path) {
  if (Array.isArray(path)) {
    return path;
  }
  return String(path).split(".");
}

function getByPath(obj, path) {
  const parts = normalizePath(path);
  let cursor = obj;
  for (const part of parts) {
    if (cursor === undefined || cursor === null) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function setByPath(obj, path, value) {
  const parts = normalizePath(path);
  let cursor = obj;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index];
    if (cursor[part] === undefined || cursor[part] === null || typeof cursor[part] !== "object") {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function deleteByPath(obj, path) {
  const parts = normalizePath(path);
  let cursor = obj;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index];
    if (cursor === undefined || cursor === null || typeof cursor !== "object") {
      return;
    }
    cursor = cursor[part];
  }
  if (cursor !== undefined && cursor !== null && typeof cursor === "object") {
    delete cursor[parts[parts.length - 1]];
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneDeep(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneDeep(entry));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneDeep(entry)]),
    );
  }
  return value;
}

function mergeDeep(baseValue, patchValue) {
  if (patchValue === undefined) {
    return cloneDeep(baseValue);
  }
  if (Array.isArray(baseValue) && Array.isArray(patchValue)) {
    return cloneDeep(patchValue);
  }
  if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
    const merged = cloneDeep(baseValue);
    Object.entries(patchValue).forEach(([key, entry]) => {
      merged[key] = mergeDeep(baseValue[key], entry);
    });
    return merged;
  }
  return cloneDeep(patchValue);
}

function normalizeSlugSource(title) {
  if (title === undefined || title === null) {
    return "";
  }

  const titleText = String(title).trim();
  if (!titleText) {
    return "";
  }

  let slug = slugify(titleText, {
    lower: true,
    strict: true,
  });

  if (!slug) {
    slug = titleText
      .normalize("NFKD")
      .toLowerCase()
      .trim()
      .replace(/['!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/\_/g, "-")
      .replace(/\-\-+/g, "-")
      .replace(/\-$/g, "");
  }

  return slug;
}

function isUniqueConstraintError(error) {
  const message = error?.message || "";
  return /UNIQUE constraint failed/i.test(message);
}

function validationError(field, message) {
  return {
    errors: [
      {
        field,
        message,
      },
    ],
  };
}

function itemInternalToRow(itemId, contentType, slug, internalItem, existingRow = null) {
  const {
    status,
    pubDateMs,
    ...data
  } = internalItem;

  const row = {
    id: itemId,
    status: status ?? STATUSES.PUBLISHED,
    content_type: contentType,
    slug,
    data: JSON.stringify(data),
  };

  if (pubDateMs !== undefined && pubDateMs !== null) {
    row.pub_date = msToRFC3339(pubDateMs);
  } else if (existingRow?.pub_date !== undefined && existingRow?.pub_date !== null) {
    row.pub_date = existingRow.pub_date;
  }

  return row;
}

function getTagsFieldDef(typeName) {
  return getFieldDefs(typeName).find((fieldDef) => fieldDef.kind === "tags");
}

function getReferenceFieldDefs(typeName) {
  return getFieldDefs(typeName).filter((fieldDef) => fieldDef.kind === "reference");
}

function rowToPublicItem(typeName, row) {
  const publicItem = {};
  const internalData = row?.data ? JSON.parse(row.data) : {};

  getFieldDefs(typeName).forEach((fieldDef) => {
    let internalValue;
    if (fieldDef.key === "status") {
      internalValue = row.status;
    } else if (fieldDef.feedMapping.target === "pubDateMs") {
      internalValue = row.pub_date !== undefined && row.pub_date !== null
        ? rfc3399ToMs(row.pub_date)
        : undefined;
    } else {
      internalValue = getByPath(internalData, fieldDef.feedMapping.target);
    }

    const publicValue = toPublic(fieldDef, internalValue);
    if (publicValue !== undefined && publicValue !== null) {
      setByPath(publicItem, fieldDef.feedMapping.source, publicValue);
    }
  });

  return publicItem;
}

export default class ContentService extends FeedCrudManager {
  constructor(feedContent, feedDb, request, mediaStore = null) {
    super(feedContent, feedDb, request);
    this.itemRepo = feedDb.itemRepo;
    this.mediaStore = mediaStore;
    this.tagLinkRepo = new TagLinkRepo(this.itemRepo.db);
    this.relationRepo = new RelationRepo(this.itemRepo.db);
  }

  async _validateReferenceItems(fieldDef, childIds) {
    if (!childIds || childIds.length === 0) {
      return {errors: []};
    }

    const allowedContentTypes = Array.isArray(fieldDef?.allowedContentTypes) && fieldDef.allowedContentTypes.length > 0
      ? fieldDef.allowedContentTypes
      : ["photo"];
    const response = await this.itemRepo.list({
      queryKwargs: {
        id__in: childIds,
      },
    });
    const rowsById = new Map(response.results.map((row) => [row.id, row]));

    const invalidIds = childIds.filter((childId) => {
      const row = rowsById.get(childId);
      if (!row || !allowedContentTypes.includes(row.content_type)) {
        return true;
      }
      if (fieldDef?.onlyPublished && row.status !== STATUSES.PUBLISHED) {
        return true;
      }
      return false;
    });

    if (invalidIds.length > 0) {
      const visibilityLabel = fieldDef?.onlyPublished ? "published " : "";
      return validationError(
        fieldDef?.key || "reference",
        `${fieldDef?.label || fieldDef?.key || "Items"} must reference existing ${visibilityLabel}${allowedContentTypes.join(", ")} items: ${invalidIds.join(", ")}`,
      );
    }

    return {errors: []};
  }

  async create(typeName, payload = {}) {
    const inputPayload = payload || {};
    let typeDef;
    try {
      typeDef = getType(typeName);
    } catch (error) {
      return validationError("content_type", error.message);
    }

    if (typeDef.singleton) {
      const existingSingleton = await this.itemRepo.getFirst({
        queryKwargs: {
          content_type: typeName,
        },
      });
      if (existingSingleton) {
        return validationError("content_type", `Only one ${typeName} may exist`);
      }
    }

    let validation;
    try {
      validation = validateItem(typeName, inputPayload);
    } catch (error) {
      return validationError("content_type", error.message);
    }
    if (validation.errors.length > 0) {
      return validation;
    }

    const internalItem = mapItem(typeName, inputPayload);
    const tagsFieldDef = getTagsFieldDef(typeName);
    if (tagsFieldDef) {
      deleteByPath(internalItem, tagsFieldDef.feedMapping.target);
    }

    const referenceFieldDefs = getReferenceFieldDefs(typeName);
    for (const fieldDef of referenceFieldDefs) {
      const referenceIds = inputPayload[fieldDef.key] || [];
      const referenceValidation = await this._validateReferenceItems(fieldDef, referenceIds);
      if (referenceValidation.errors.length > 0) {
        return referenceValidation;
      }
      if (fieldDef.relationType) {
        deleteByPath(internalItem, fieldDef.feedMapping.target);
      }
    }

    const itemId = inputPayload.id || randomShortUUID();
    // Prefer an explicit, user-defined slug; only fall back to inferring one
    // from the title (then a random id) when none was provided.
    const explicitSlug = normalizeSlugSource(inputPayload.slug);
    const slug = typeDef.singleton
      ? "home"
      : explicitSlug || normalizeSlugSource(inputPayload.title) || randomShortUUID();
    const existingWithSlug = await this.itemRepo.getByTypeAndSlug(typeName, slug);
    if (existingWithSlug) {
      return validationError("slug", "Slug already exists for this content type");
    }

    const row = itemInternalToRow(itemId, typeName, slug, internalItem);

    try {
      await this.itemRepo.insert(row);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return validationError("slug", "Slug already exists for this content type");
      }
      throw error;
    }

    if (tagsFieldDef) {
      const tagIds = inputPayload[tagsFieldDef.key] || [];
      await this.tagLinkRepo.setItemTags(itemId, tagIds);
    }

    for (const fieldDef of referenceFieldDefs) {
      if (!fieldDef.relationType) {
        continue;
      }
      const referenceIds = inputPayload[fieldDef.key] || [];
      await this.relationRepo.setMembers(itemId, referenceIds, fieldDef.relationType);
    }

    return itemId;
  }

  async update(itemId, payload = {}) {
    const inputPayload = payload || {};
    const existingRow = await this.itemRepo.getById(itemId);
    if (!existingRow) {
      return validationError("id", "Item not found");
    }

    let typeName = existingRow.content_type;
    if (!typeName) {
      return validationError("content_type", "Item content type is missing");
    }

    let typeDef;
    try {
      typeDef = getType(typeName);
    } catch (error) {
      return validationError("content_type", error.message);
    }

    let existingPublicItem;
    try {
      existingPublicItem = rowToPublicItem(typeName, existingRow);
    } catch (error) {
      return validationError("content_type", error.message);
    }

    const tagsFieldDef = getTagsFieldDef(typeName);
    if (tagsFieldDef) {
      const existingTagIds = await this.tagLinkRepo.getTagIdsForItem(itemId);
      setByPath(existingPublicItem, tagsFieldDef.feedMapping.source, existingTagIds);
    }

    const referenceFieldDefs = getReferenceFieldDefs(typeName);
    for (const fieldDef of referenceFieldDefs) {
      if (!fieldDef.relationType) {
        continue;
      }
      const existingMemberIds = await this.relationRepo.getMemberIds(itemId, fieldDef.relationType);
      setByPath(existingPublicItem, fieldDef.feedMapping.source, existingMemberIds);
    }

    const mergedPublicItem = mergeDeep(existingPublicItem, inputPayload);

    for (const fieldDef of referenceFieldDefs) {
      const mergedMemberIds = getByPath(mergedPublicItem, fieldDef.feedMapping.source) || [];
      const membersValidation = await this._validateReferenceItems(fieldDef, mergedMemberIds);
      if (membersValidation.errors.length > 0) {
        return membersValidation;
      }
    }

    let validation;
    try {
      validation = validateItem(typeName, mergedPublicItem);
    } catch (error) {
      return validationError("content_type", error.message);
    }

    if (validation.errors.length > 0) {
      return validation;
    }

    const internalItem = mapItem(typeName, mergedPublicItem);
    if (tagsFieldDef) {
      deleteByPath(internalItem, tagsFieldDef.feedMapping.target);
    }
    for (const fieldDef of referenceFieldDefs) {
      if (fieldDef.relationType) {
        deleteByPath(internalItem, fieldDef.feedMapping.target);
      }
    }

    // On update, an explicit slug in the payload takes effect; otherwise the
    // existing slug is preserved (editing the title does NOT silently re-slug
    // and break the item's url). Only brand-new items with neither fall back
    // to inferring from the title.
    const explicitSlug = normalizeSlugSource(inputPayload.slug);
    const slug = typeDef.singleton
      ? "home"
      : explicitSlug || existingRow.slug || normalizeSlugSource(mergedPublicItem.title) || randomShortUUID();
    const existingWithSlug = await this.itemRepo.getByTypeAndSlug(typeName, slug);
    if (existingWithSlug && existingWithSlug.id !== itemId) {
      return validationError("slug", "Slug already exists for this content type");
    }

    const row = itemInternalToRow(itemId, typeName, slug, internalItem, existingRow);

    try {
      await this.itemRepo.update(itemId, row);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return validationError("slug", "Slug already exists for this content type");
      }
      throw error;
    }

    if (tagsFieldDef) {
      const mergedTagIds = getByPath(mergedPublicItem, tagsFieldDef.feedMapping.source) || [];
      await this.tagLinkRepo.setItemTags(itemId, mergedTagIds);
    }

    for (const fieldDef of referenceFieldDefs) {
      if (!fieldDef.relationType) {
        continue;
      }
      const mergedMemberIds = getByPath(mergedPublicItem, fieldDef.feedMapping.source) || [];
      await this.relationRepo.setMembers(itemId, mergedMemberIds, fieldDef.relationType);
    }

    return itemId;
  }

  async delete(itemId) {
    const existingRow = await this.itemRepo.getById(itemId);
    if (!existingRow) {
      return validationError("id", "Item not found");
    }

    const typeDef = getType(existingRow.content_type);
    if (typeDef.singleton) {
      return validationError("id", "Singleton items cannot be deleted");
    }

    await this.itemRepo.update(itemId, {status: STATUSES.DELETED});

    return itemId;
  }

  async purge(itemId, {force = false} = {}) {
    const existingRow = await this.itemRepo.getById(itemId);
    if (!existingRow) {
      return validationError("id", "Item not found");
    }

    const typeDef = getType(existingRow.content_type);
    if (typeDef.singleton) {
      return validationError("id", "Singleton items cannot be purged");
    }

    if (existingRow.status !== STATUSES.DELETED && !force) {
      return validationError("id", "Item must be soft-deleted before purge");
    }

    const typeName = existingRow.content_type;
    const mediaKeys = [];
    if (typeName) {
      let internalData = {};
      try {
        internalData = existingRow.data ? JSON.parse(existingRow.data) : {};
      } catch (error) {
        internalData = {};
      }

      getFieldDefs(typeName).forEach((fieldDef) => {
        if (fieldDef.kind === "image") {
          const key = getByPath(internalData, fieldDef.feedMapping.target);
          if (key) {
            mediaKeys.push(key);
          }
        } else if (fieldDef.kind === "media") {
          const mediaFile = getByPath(internalData, fieldDef.feedMapping.target);
          const key = mediaFile && mediaFile.url;
          if (key) {
            mediaKeys.push(key);
          }
        }
      });
    }

    if (this.mediaStore) {
      for (const key of mediaKeys) {
        await this.mediaStore.deleteObject(key);
      }
    }

    const db = this.itemRepo.db;
    await db.batch([
      db.prepare("DELETE FROM item_tags WHERE item_id = ?").bind(itemId),
      db.prepare("DELETE FROM item_relations WHERE parent_item_id = ? OR child_item_id = ?").bind(itemId, itemId),
      this.itemRepo.buildDeleteStatement(itemId),
    ]);

    return itemId;
  }

  async restore(itemId) {
    const existingRow = await this.itemRepo.getById(itemId);
    if (!existingRow) {
      return validationError("id", "Item not found");
    }

    if (existingRow.status !== STATUSES.DELETED) {
      return validationError("id", "Item is not deleted");
    }

    await this.itemRepo.update(itemId, {status: STATUSES.UNPUBLISHED});

    return itemId;
  }

  async _resolveExistingIds(ids) {
    if (!ids || ids.length === 0) {
      return {existingIds: [], skipped: []};
    }

    const response = await this.itemRepo.list({
      queryKwargs: {
        id__in: ids,
      },
    });
    const existingIdSet = new Set(response.results.map((row) => row.id));

    const existingIds = [];
    const skipped = [];
    ids.forEach((id) => {
      if (existingIdSet.has(id)) {
        existingIds.push(id);
      } else {
        skipped.push({id, reason: "not found"});
      }
    });

    return {existingIds, skipped};
  }

  async _bulkSetStatus(ids, status) {
    const {existingIds, skipped} = await this._resolveExistingIds(ids);

    if (existingIds.length === 0) {
      return {succeeded: [], skipped};
    }

    const db = this.itemRepo.db;
    await db.batch(
      existingIds.map((id) => this.itemRepo.buildUpdateStatement(id, {status})),
    );

    return {succeeded: existingIds, skipped};
  }

  async bulkPublish(ids) {
    return this._bulkSetStatus(ids, STATUSES.PUBLISHED);
  }

  async bulkUnpublish(ids) {
    return this._bulkSetStatus(ids, STATUSES.UNPUBLISHED);
  }

  async bulkDelete(ids) {
    return this._bulkSetStatus(ids, STATUSES.DELETED);
  }

  async bulkTag(ids, tagIds = []) {
    const {existingIds, skipped} = await this._resolveExistingIds(ids);

    if (existingIds.length === 0) {
      return {succeeded: [], skipped};
    }

    if (tagIds.length > 0) {
      const db = this.itemRepo.db;
      const statements = [];
      existingIds.forEach((id) => {
        tagIds.forEach((tagId) => {
          statements.push(
            db.prepare(
              "INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?) ON CONFLICT(item_id, tag_id) DO NOTHING",
            ).bind(id, tagId),
          );
        });
      });
      await db.batch(statements);
    }

    return {succeeded: existingIds, skipped};
  }
}
