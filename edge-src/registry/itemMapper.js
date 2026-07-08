import {getFieldDefs, getType} from "./ContentTypeRegistry";
import {toInternal, validate} from "./fieldKinds";

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

function shouldSkipValue(fieldDef, value) {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string" && value.length === 0 && !fieldDef.required) {
    return true;
  }
  if (Array.isArray(value) && value.length === 0 && !fieldDef.required) {
    return true;
  }
  return false;
}

export function validateItem(typeName, payload) {
  getType(typeName);
  const errors = [];
  getFieldDefs(typeName).forEach((fieldDef) => {
    const value = getByPath(payload, fieldDef.feedMapping.source);
    const errorMessage = validate(fieldDef, value);
    if (errorMessage) {
      errors.push({
        field: fieldDef.key,
        message: errorMessage,
      });
    }
  });
  return {errors};
}

export function mapItem(typeName, payload) {
  const validation = validateItem(typeName, payload);
  if (validation.errors.length > 0) {
    return validation;
  }

  const internal = {};
  getFieldDefs(typeName).forEach((fieldDef) => {
    const value = getByPath(payload, fieldDef.feedMapping.source);
    if (shouldSkipValue(fieldDef, value)) {
      return;
    }
    setByPath(internal, fieldDef.feedMapping.target, toInternal(fieldDef, value));
  });
  return internal;
}

export default {
  mapItem,
  validateItem,
};
