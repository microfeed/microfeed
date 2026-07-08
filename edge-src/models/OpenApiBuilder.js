import {listTypes} from "../registry/ContentTypeRegistry";
import {OUR_BRAND} from "../../common-src/Constants";

const API_KEY_SECURITY_SCHEME_NAME = "x-microfeedapi-key";

function typeNameToSchemaName(typeName) {
  return typeName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function buildMediaProperty() {
  return {
    type: "object",
    properties: {
      category: {type: "string"},
      url: {type: "string"},
      mime_type: {type: "string"},
      size_in_bytes: {type: "number"},
      duration_in_seconds: {type: "number"},
    },
  };
}

function buildFieldProperty(fieldDef) {
  switch (fieldDef.kind) {
    case "text":
    case "richtext":
    case "url":
    case "image":
      return {type: "string"};
    case "number":
      return fieldDef.integer ? {type: "integer"} : {type: "number"};
    case "boolean":
      return {type: "boolean"};
    case "date":
      return {type: "integer", description: "epoch milliseconds"};
    case "enum": {
      const options = fieldDef.options || [];
      if (fieldDef.multiple) {
        return {
          type: "array",
          items: {type: "string", enum: options},
        };
      }
      return {type: "string", enum: options};
    }
    case "media":
      return buildMediaProperty();
    case "tags":
    case "reference":
    case "string_list":
      return {type: "array", items: {type: "string"}};
    default:
      throw new Error(`Unsupported field kind: ${fieldDef.kind}`);
  }
}

function buildTypeSchema(typeDef) {
  const properties = {};
  const required = [];

  for (const fieldDef of typeDef.fieldDefs) {
    properties[fieldDef.key] = buildFieldProperty(fieldDef);
    if (fieldDef.required === true) {
      required.push(fieldDef.key);
    }
  }

  const schema = {
    type: "object",
    properties,
  };
  if (required.length > 0) {
    schema.required = required;
  }
  return schema;
}

function buildSchemas(typeDefs, contentTypeNames) {
  const schemas = {};

  for (const typeDef of typeDefs) {
    schemas[typeNameToSchemaName(typeDef.name)] = buildTypeSchema(typeDef);
  }

  schemas.Tag = {
    type: "object",
    properties: {
      id: {type: "string"},
      name: {type: "string"},
      slug: {type: "string"},
    },
  };

  schemas.Error = {
    type: "object",
    properties: {
      errors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: {type: "string"},
            message: {type: "string"},
          },
        },
      },
    },
  };

  // Shared create/base concept: a content_type discriminator property,
  // useful for consumers building a generic "create item" request body.
  schemas.ItemCreateRequest = {
    type: "object",
    description: "Base request body for creating an item of any registered content type. Include the fields for the chosen content_type alongside it.",
    properties: {
      content_type: {
        type: "string",
        enum: contentTypeNames,
      },
    },
    required: ["content_type"],
  };

  return schemas;
}

function errorResponse(description) {
  return {
    description,
    content: {
      "application/json": {
        schema: {$ref: "#/components/schemas/Error"},
      },
    },
  };
}

function securedOperation(operation) {
  return {
    ...operation,
    security: [{[API_KEY_SECURITY_SCHEME_NAME]: []}],
  };
}

function buildPaths(contentTypeNames) {
  const itemIdParam = {
    name: "itemId",
    in: "path",
    required: true,
    schema: {type: "string"},
    description: "An item's id or slug.",
  };

  const tagIdParam = {
    name: "tagId",
    in: "path",
    required: true,
    schema: {type: "string"},
    description: "A tag's id or slug.",
  };

  return {
    "/api/items": {
      post: securedOperation({
        summary: "Create a new item",
        description: "Creates a new item of any registered content type. The body must include content_type plus that type's fields.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {$ref: "#/components/schemas/ItemCreateRequest"},
            },
          },
        },
        responses: {
          201: {
            description: "Item created.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {id: {type: "string"}},
                },
              },
            },
          },
          400: errorResponse("Validation error."),
        },
      }),
    },
    "/api/items/{itemId}": {
      get: securedOperation({
        summary: "Fetch an item",
        parameters: [itemIdParam],
        responses: {
          200: {description: "Success response."},
          404: errorResponse("Item not found."),
        },
      }),
      put: securedOperation({
        summary: "Update an item",
        parameters: [itemIdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {$ref: "#/components/schemas/ItemCreateRequest"},
            },
          },
        },
        responses: {
          200: {
            description: "Item updated.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {id: {type: "string"}},
                },
              },
            },
          },
          400: errorResponse("Validation error."),
          404: errorResponse("Item not found."),
        },
      }),
      delete: securedOperation({
        summary: "Soft delete an item",
        parameters: [itemIdParam],
        responses: {
          200: {description: "Item deleted."},
          400: errorResponse("Bad request."),
          404: errorResponse("Item not found."),
        },
      }),
    },
    "/api/items/{itemId}/restore": {
      post: securedOperation({
        summary: "Restore a soft-deleted item",
        parameters: [itemIdParam],
        responses: {
          200: {description: "Item restored."},
          400: errorResponse("Bad request."),
          404: errorResponse("Item not found."),
        },
      }),
    },
    "/api/items/{itemId}/purge": {
      post: securedOperation({
        summary: "Permanently purge an item",
        description: "Hard-deletes the item's row, its tag/relation links, and its R2 media. Only allowed for soft-deleted items unless forced.",
        parameters: [itemIdParam],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  force: {type: "boolean"},
                },
              },
            },
          },
        },
        responses: {
          200: {description: "Item purged."},
          400: errorResponse("Bad request, or item is not eligible for purge."),
          404: errorResponse("Item not found."),
        },
      }),
    },
    "/api/items/bulk": {
      post: securedOperation({
        summary: "Bulk operation over items",
        description: "Perform a bulk action (publish, unpublish, delete, tag) over a set of item ids.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: {
                    type: "string",
                    enum: ["publish", "unpublish", "delete", "tag"],
                  },
                  ids: {type: "array", items: {type: "string"}},
                  tagIds: {type: "array", items: {type: "string"}},
                },
                required: ["action", "ids"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Bulk operation result.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    succeeded: {type: "array", items: {type: "string"}},
                    skipped: {type: "array", items: {type: "string"}},
                  },
                },
              },
            },
          },
          400: errorResponse("Validation error."),
        },
      }),
    },
    "/api/tags": {
      get: securedOperation({
        summary: "List tags",
        responses: {
          200: {
            description: "Success response.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tags: {
                      type: "array",
                      items: {$ref: "#/components/schemas/Tag"},
                    },
                  },
                },
              },
            },
          },
        },
      }),
      post: securedOperation({
        summary: "Create a tag",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: {type: "string"},
                },
                required: ["name"],
              },
            },
          },
        },
        responses: {
          201: {
            description: "Tag created.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {tag: {$ref: "#/components/schemas/Tag"}},
                },
              },
            },
          },
          400: errorResponse("Validation error."),
        },
      }),
    },
    "/api/tags/{tagId}": {
      put: securedOperation({
        summary: "Rename a tag",
        parameters: [tagIdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: {type: "string"},
                },
                required: ["name"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Tag updated.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {tag: {$ref: "#/components/schemas/Tag"}},
                },
              },
            },
          },
          400: errorResponse("Validation error."),
          404: errorResponse("Tag not found."),
        },
      }),
      delete: securedOperation({
        summary: "Delete a tag",
        parameters: [tagIdParam],
        responses: {
          200: {description: "Tag deleted."},
          404: errorResponse("Tag not found."),
        },
      }),
    },
    "/api/feed": {
      get: securedOperation({
        summary: "Fetch the feed as JSON (authenticated)",
        description: "Returns the same shape as GET /json but requires the API key and works even when the public JSON feed is disabled.",
        responses: {
          200: {description: "Success response."},
        },
      }),
    },
    "/json": {
      get: {
        summary: "Fetch the public JSON feed",
        description: "Public JSON feed endpoint, following the jsonfeed.org format. No authentication required.",
        responses: {
          200: {description: "Success response."},
          404: {description: "JSON feed is disabled."},
        },
      },
    },
  };
}

/**
 * Builds a plain-JS OpenAPI 3.0 document generated FROM the content type
 * registry, so it never drifts from the actual registered types.
 */
export function buildOpenApiSpec({baseUrl, version}) {
  const typeDefs = listTypes();
  const contentTypeNames = typeDefs.map((typeDef) => typeDef.name);

  return {
    openapi: "3.0.3",
    info: {
      title: `${OUR_BRAND.brandName} API`,
      version,
    },
    servers: [{url: baseUrl}],
    paths: buildPaths(contentTypeNames),
    components: {
      securitySchemes: {
        [API_KEY_SECURITY_SCHEME_NAME]: {
          type: "apiKey",
          in: "header",
          name: API_KEY_SECURITY_SCHEME_NAME,
        },
      },
      schemas: buildSchemas(typeDefs, contentTypeNames),
    },
  };
}

export default {
  buildOpenApiSpec,
};
