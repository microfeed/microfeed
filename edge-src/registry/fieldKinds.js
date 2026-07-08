import {ENCLOSURE_CATEGORIES, STATUSES} from "../../common-src/Constants";
import {isValidUrl, removeHostFromUrl} from "../../common-src/StringUtils";

const ENCODINGS = {
  status: {
    published: STATUSES.PUBLISHED,
    unlisted: STATUSES.UNLISTED,
    unpublished: STATUSES.UNPUBLISHED,
  },
};

const ALLOWED_ENCLOSURE_CATEGORIES = new Set(Object.values(ENCLOSURE_CATEGORIES));

function isMissing(value) {
  return value === undefined || value === null || value === "";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return Number.isFinite(Number(value));
  }
  return false;
}

function normalizeNumber(value) {
  if (typeof value === "number") {
    return value;
  }
  return Number(value);
}

function normalizeDate(value) {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  return new Date(value).getTime();
}

function validateString(def, value, label) {
  if (isMissing(value)) {
    return def.required ? `${label} is required` : null;
  }
  if (!isNonEmptyString(value)) {
    return `${label} must be a string`;
  }
  if (def.kind === "url" && !isValidUrl(value)) {
    return `${label} must be a valid url`;
  }
  return null;
}

function validateEnum(def, value, label) {
  if (isMissing(value)) {
    return def.required ? `${label} is required` : null;
  }

  const options = def.options || [];
  if (def.multiple) {
    if (!Array.isArray(value)) {
      return `${label} must be an array`;
    }
    const invalidValue = value.find((entry) => !options.includes(entry));
    if (invalidValue !== undefined) {
      return `${label} must be one of ${options.join(", ")}`;
    }
    return null;
  }

  if (!options.includes(value)) {
    return `${label} must be one of ${options.join(", ")}`;
  }
  return null;
}

function validateNumber(def, value, label) {
  if (isMissing(value)) {
    return def.required ? `${label} is required` : null;
  }
  if (!isFiniteNumber(value)) {
    return `${label} must be a number`;
  }
  const normalized = normalizeNumber(value);
  if (def.integer && !Number.isInteger(normalized)) {
    return `${label} must be an integer`;
  }
  if (def.min !== undefined && normalized < def.min) {
    return `${label} must be greater than or equal to ${def.min}`;
  }
  if (def.max !== undefined && normalized > def.max) {
    return `${label} must be less than or equal to ${def.max}`;
  }
  return null;
}

function validateDate(def, value, label) {
  if (isMissing(value)) {
    return def.required ? `${label} is required` : null;
  }
  const normalized = normalizeDate(value);
  if (!Number.isFinite(normalized)) {
    return `${label} must be a valid date`;
  }
  if (def.integer && !Number.isInteger(normalized)) {
    return `${label} must be an integer`;
  }
  return null;
}

function validateArrayOfStrings(def, value, label) {
  if (isMissing(value)) {
    return def.required ? `${label} is required` : null;
  }
  if (!Array.isArray(value)) {
    return `${label} must be an array`;
  }
  const invalidEntry = value.find((entry) => !isNonEmptyString(entry));
  if (invalidEntry !== undefined) {
    return `${label} must contain non-empty strings`;
  }
  return null;
}

function validateMedia(def, value, label) {
  if (isMissing(value)) {
    return def.required ? `${label} is required` : null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return `${label} must be an object`;
  }
  if (!isNonEmptyString(value.category) || !ALLOWED_ENCLOSURE_CATEGORIES.has(value.category)) {
    return `${label} must use a supported media category`;
  }
  if (!isNonEmptyString(value.url)) {
    return `${label} must include a url`;
  }
  if (value.mime_type !== undefined && !isNonEmptyString(value.mime_type)) {
    return `${label} mime_type must be a string`;
  }
  if (value.size_in_bytes !== undefined && !isFiniteNumber(value.size_in_bytes)) {
    return `${label} size_in_bytes must be a number`;
  }
  if (value.duration_in_seconds !== undefined && !isFiniteNumber(value.duration_in_seconds)) {
    return `${label} duration_in_seconds must be a number`;
  }
  return null;
}

export function validate(def, value) {
  const label = def.label || def.key || def.kind;
  switch (def.kind) {
    case "text":
    case "richtext":
    case "url":
    case "image":
      return validateString(def, value, label);
    case "media":
      return validateMedia(def, value, label);
    case "boolean":
      if (isMissing(value)) {
        return def.required ? `${label} is required` : null;
      }
      return typeof value === "boolean" ? null : `${label} must be a boolean`;
    case "number":
      return validateNumber(def, value, label);
    case "date":
      return validateDate(def, value, label);
    case "enum":
      return validateEnum(def, value, label);
    case "tags":
    case "reference":
    case "string_list":
      return validateArrayOfStrings(def, value, label);
    default:
      throw new Error(`Unsupported field kind: ${def.kind}`);
  }
}

export function toInternal(def, value) {
  if (isMissing(value)) {
    return value;
  }

  switch (def.kind) {
    case "text":
    case "richtext":
      return value;
    case "image":
      return removeHostFromUrl(value);
    case "url":
      return value;
    case "media": {
      const mediaFile = {
        category: value.category,
        url: value.category === ENCLOSURE_CATEGORIES.EXTERNAL_URL ? value.url : removeHostFromUrl(value.url),
      };
      if (value.mime_type !== undefined) {
        mediaFile.contentType = value.mime_type;
      }
      if (value.size_in_bytes !== undefined) {
        mediaFile.sizeByte = normalizeNumber(value.size_in_bytes);
      }
      if (value.duration_in_seconds !== undefined) {
        mediaFile.durationSecond = normalizeNumber(value.duration_in_seconds);
      }
      return mediaFile;
    }
    case "boolean":
      return value;
    case "number":
      return normalizeNumber(value);
    case "date":
      return normalizeDate(value);
    case "enum": {
      if (def.multiple) {
        return [...value];
      }
      if (def.valueMap) {
        return def.valueMap[value];
      }
      return value;
    }
    case "tags":
    case "reference":
    case "string_list":
      return [...value];
    default:
      throw new Error(`Unsupported field kind: ${def.kind}`);
  }
}

export function toPublic(def, value) {
  if (isMissing(value)) {
    return value;
  }

  switch (def.kind) {
    case "text":
    case "richtext":
    case "image":
    case "url":
      return value;
    case "media": {
      const attachment = {
        category: value.category,
        url: value.url,
      };
      if (value.contentType !== undefined) {
        attachment.mime_type = value.contentType;
      }
      if (value.sizeByte !== undefined) {
        attachment.size_in_bytes = value.sizeByte;
      }
      if (value.durationSecond !== undefined) {
        attachment.duration_in_seconds = value.durationSecond;
      }
      return attachment;
    }
    case "boolean":
      return value;
    case "number":
      return value;
    case "date":
      return value;
    case "enum": {
      if (def.multiple) {
        return [...value];
      }
      if (def.valueMap) {
        const reverseMap = Object.fromEntries(
          Object.entries(def.valueMap).map(([publicValue, internalValue]) => [internalValue, publicValue]),
        );
        return reverseMap[value] !== undefined ? reverseMap[value] : value;
      }
      return value;
    }
    case "tags":
    case "reference":
    case "string_list":
      return [...value];
    default:
      throw new Error(`Unsupported field kind: ${def.kind}`);
  }
}

export default {
  validate,
  toInternal,
  toPublic,
};
