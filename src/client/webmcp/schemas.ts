const MAX_ITEMS_PER_PAGE = 300;
const PAGE_META_DESCRIPTION_MAX_LENGTH = 155;
const PAGE_SLUG_MAX_LENGTH = 100;

interface InputContract<T> {
  jsonSchema: Record<string, unknown>;
  parse: (input: unknown) => T;
}

interface ListItemsInput {
  cursor?: string;
  limit?: number;
  status?: "published" | "unlisted" | "unpublished";
}

export interface SaveItemDraftInput {
  content_html?: string;
  title?: string;
}

export interface SavePageDraftInput {
  content_html?: string;
  meta_description?: string;
  navigation_label?: string;
  show_in_navigation?: boolean;
  slug?: string;
  title?: string;
}

function objectInput(input: unknown): Record<string, unknown> {
  const value = input ?? {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Tool input must be an object.");
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(
  input: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(input).find((key) => !allowedKeys.has(key));
  if (unknown) throw new TypeError(`Unrecognized key: "${unknown}"`);
}

function optionalString(
  input: Record<string, unknown>,
  key: string,
  options: {max?: number; nonempty?: boolean} = {},
): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new TypeError(`${key} must be a string.`);
  }
  if (options.nonempty && !value.trim()) {
    throw new TypeError(`${key} must not be empty.`);
  }
  if (options.max !== undefined && value.length > options.max) {
    throw new TypeError(`${key} must be at most ${options.max} characters.`);
  }
  return value;
}

function objectSchema(
  properties: Record<string, unknown>,
  options: {minProperties?: number; required?: string[]} = {},
): Record<string, unknown> {
  return {
    additionalProperties: false,
    ...(options.minProperties === undefined
      ? {}
      : {minProperties: options.minProperties}),
    properties,
    ...(options.required ? {required: options.required} : {}),
    type: "object",
  };
}

export const listItemsInputSchema: InputContract<ListItemsInput> = {
  jsonSchema: objectSchema({
    cursor: {
      description: "Opaque next cursor returned by the previous call.",
      minLength: 1,
      type: "string",
    },
    limit: {
      description: `Maximum summaries to return, from 1 to ${MAX_ITEMS_PER_PAGE}.`,
      maximum: MAX_ITEMS_PER_PAGE,
      minimum: 1,
      type: "integer",
    },
    status: {
      enum: ["published", "unlisted", "unpublished"],
      type: "string",
    },
  }),
  parse(input) {
    const value = objectInput(input);
    rejectUnknownKeys(value, ["cursor", "limit", "status"]);
    const cursor = optionalString(value, "cursor", {nonempty: true});
    const limit = value.limit;
    if (
      limit !== undefined &&
      (typeof limit !== "number" || !Number.isInteger(limit) ||
        limit < 1 || limit > MAX_ITEMS_PER_PAGE)
    ) {
      throw new TypeError(
        `limit must be an integer from 1 to ${MAX_ITEMS_PER_PAGE}.`,
      );
    }
    const status = value.status;
    if (
      status !== undefined && status !== "published" &&
      status !== "unlisted" && status !== "unpublished"
    ) {
      throw new TypeError("status must be published, unlisted, or unpublished.");
    }
    return {
      ...(cursor ? {cursor} : {}),
      ...(limit === undefined ? {} : {limit: limit as number}),
      ...(status === undefined
        ? {}
        : {status: status as ListItemsInput["status"]}),
    };
  },
};

function idInput(
  key: "item_id" | "page_id",
): InputContract<Record<string, string>> {
  return {
    jsonSchema: objectSchema({
      [key]: {maxLength: 200, minLength: 1, type: "string"},
    }, {required: [key]}),
    parse(input) {
      const value = objectInput(input);
      rejectUnknownKeys(value, [key]);
      const id = optionalString(value, key, {max: 200, nonempty: true});
      if (!id) throw new TypeError(`${key} is required.`);
      return {[key]: id};
    },
  };
}

export const getItemInputSchema = idInput("item_id") as InputContract<{
  item_id: string;
}>;
export const getPageInputSchema = idInput("page_id") as InputContract<{
  page_id: string;
}>;

export const emptyInputSchema: InputContract<Record<string, never>> = {
  jsonSchema: objectSchema({}),
  parse(input) {
    const value = objectInput(input);
    rejectUnknownKeys(value, []);
    return {};
  },
};

export const startDraftInputSchema: InputContract<{kind: "item" | "page"}> = {
  jsonSchema: objectSchema({
    kind: {enum: ["item", "page"], type: "string"},
  }, {required: ["kind"]}),
  parse(input) {
    const value = objectInput(input);
    rejectUnknownKeys(value, ["kind"]);
    if (value.kind !== "item" && value.kind !== "page") {
      throw new TypeError("kind must be item or page.");
    }
    return {kind: value.kind};
  },
};

export const saveItemDraftInputSchema: InputContract<SaveItemDraftInput> = {
  jsonSchema: objectSchema({
    content_html: {
      description: "Rich-text HTML for the item body.",
      type: "string",
    },
    title: {type: "string"},
  }, {minProperties: 1}),
  parse(input) {
    const value = objectInput(input);
    rejectUnknownKeys(value, ["content_html", "title"]);
    const contentHtml = optionalString(value, "content_html");
    const title = optionalString(value, "title");
    if (contentHtml === undefined && title === undefined) {
      throw new TypeError("Supply at least one item field to save.");
    }
    return {
      ...(contentHtml === undefined ? {} : {content_html: contentHtml}),
      ...(title === undefined ? {} : {title}),
    };
  },
};

export const savePageDraftInputSchema: InputContract<SavePageDraftInput> = {
  jsonSchema: objectSchema({
    content_html: {
      description: "Rich-text HTML for the Page body.",
      type: "string",
    },
    meta_description: {
      maxLength: PAGE_META_DESCRIPTION_MAX_LENGTH,
      type: "string",
    },
    navigation_label: {maxLength: 100, type: "string"},
    show_in_navigation: {type: "boolean"},
    slug: {maxLength: PAGE_SLUG_MAX_LENGTH, type: "string"},
    title: {maxLength: 200, type: "string"},
  }, {minProperties: 1}),
  parse(input) {
    const value = objectInput(input);
    rejectUnknownKeys(value, [
      "content_html",
      "meta_description",
      "navigation_label",
      "show_in_navigation",
      "slug",
      "title",
    ]);
    const result: SavePageDraftInput = {
      ...(value.content_html === undefined
        ? {}
        : {content_html: optionalString(value, "content_html")}),
      ...(value.meta_description === undefined
        ? {}
        : {
            meta_description: optionalString(value, "meta_description", {
              max: PAGE_META_DESCRIPTION_MAX_LENGTH,
            }),
          }),
      ...(value.navigation_label === undefined
        ? {}
        : {
            navigation_label: optionalString(value, "navigation_label", {
              max: 100,
            }),
          }),
      ...(value.slug === undefined
        ? {}
        : {
            slug: optionalString(value, "slug", {max: PAGE_SLUG_MAX_LENGTH}),
          }),
      ...(value.title === undefined
        ? {}
        : {title: optionalString(value, "title", {max: 200})}),
    };
    if (value.show_in_navigation !== undefined) {
      if (typeof value.show_in_navigation !== "boolean") {
        throw new TypeError("show_in_navigation must be a boolean.");
      }
      result.show_in_navigation = value.show_in_navigation;
    }
    if (Object.keys(result).length === 0) {
      throw new TypeError("Supply at least one Page field to save.");
    }
    return result;
  },
};

export function inputJsonSchema<T>(
  schema: InputContract<T>,
): Record<string, unknown> {
  return schema.jsonSchema;
}

export function parseInput<T>(schema: InputContract<T>, input: unknown): T {
  return schema.parse(input);
}
