import {urlJoinWithRelative} from "../../common-src/StringUtils";
import {rfc3399ToMs} from "../../common-src/TimeUtils";
import {ENCLOSURE_CATEGORIES} from "../../common-src/Constants";
import {getFieldDefs, isAggregator} from "../registry/ContentTypeRegistry";
import {toPublic} from "../registry/fieldKinds";

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

export function serializeItemForFeed(itemRow, {publicBucketUrl = "", tagIds = [], members = []} = {}) {
  const row = itemRow || {};
  const contentType = row.content_type;
  const publicItem = {};
  const internalData = row.data ? JSON.parse(row.data) : {};

  getFieldDefs(contentType).forEach((fieldDef) => {
    if (fieldDef.key === "status" || fieldDef.feedMapping.target === "pubDateMs") {
      // status and date_published_ms are always set separately below.
      return;
    }

    const internalValue = getByPath(internalData, fieldDef.feedMapping.target);

    let publicValue = toPublic(fieldDef, internalValue);
    if (publicValue === undefined || publicValue === null) {
      return;
    }

    if (fieldDef.kind === "image") {
      publicValue = urlJoinWithRelative(publicBucketUrl, publicValue);
    } else if (fieldDef.kind === "media") {
      if (publicValue.category !== ENCLOSURE_CATEGORIES.EXTERNAL_URL && publicValue.url) {
        publicValue = {
          ...publicValue,
          url: urlJoinWithRelative(publicBucketUrl, publicValue.url),
        };
      }
    }

    setByPath(publicItem, fieldDef.feedMapping.source, publicValue);
  });

  publicItem.id = row.id;
  publicItem.content_type = contentType;
  publicItem.slug = row.slug;
  publicItem.status = toPublic(
    {kind: "enum", valueMap: {published: 1, unpublished: 2, unlisted: 4}},
    row.status,
  );

  if (row.pub_date !== undefined && row.pub_date !== null) {
    publicItem.date_published_ms = rfc3399ToMs(row.pub_date);
  }

  const tagsFieldDef = getFieldDefs(contentType).find((fieldDef) => fieldDef.kind === "tags");
  if (tagsFieldDef) {
    publicItem.tags = tagIds;
  }

  if (isAggregator(contentType)) {
    publicItem.items = members;
  }

  return publicItem;
}

export default {
  serializeItemForFeed,
};
