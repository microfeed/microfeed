import {buildOpenApiSpec} from "./OpenApiBuilder";
import {listTypes, getFieldDefs} from "../registry/ContentTypeRegistry";

function typeNameToSchemaName(typeName) {
  return typeName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

describe("OpenApiBuilder", () => {
  const baseUrl = "https://example-feed.com";
  const version = "1.2.3";
  const spec = buildOpenApiSpec({baseUrl, version});

  test("declares openapi version, info, and servers", () => {
    expect(spec.openapi).toMatch(/^3\.0\.\d+$/);
    expect(spec.info).toBeDefined();
    expect(spec.info.version).toBe(version);
    expect(spec.info.title).toBe("My Feed API");
    expect(spec.servers).toEqual([{url: baseUrl}]);
  });

  test("components.schemas contains a schema for every registry type", () => {
    const types = listTypes();
    for (const type of types) {
      const schemaName = typeNameToSchemaName(type.name);
      expect(spec.components.schemas[schemaName]).toBeDefined();
      expect(spec.components.schemas[schemaName].type).toBe("object");
    }
  });

  test("required fields are listed per schema (title required for PodcastEpisode/BlogArticle)", () => {
    const podcastSchema = spec.components.schemas.PodcastEpisode;
    const blogSchema = spec.components.schemas.BlogArticle;

    expect(podcastSchema.required).toContain("title");
    expect(blogSchema.required).toContain("title");
    expect(blogSchema.required).toContain("content_html");

    const photoSchema = spec.components.schemas.Photo;
    expect(photoSchema.required).toContain("image");

    const gallerySchema = spec.components.schemas.Gallery;
    expect(gallerySchema.required).toContain("title");
    expect(gallerySchema.required).toContain("members");
  });

  test("enum field surfaces options (podcast itunes:episodeType)", () => {
    const podcastSchema = spec.components.schemas.PodcastEpisode;
    const episodeType = podcastSchema.properties["itunes:episodeType"];
    expect(episodeType).toBeDefined();
    expect(episodeType.type).toBe("string");
    expect(episodeType.enum).toEqual(["full", "trailer", "bonus"]);
  });

  test("multiple-enum field wraps as array of enum strings (landing_page content_types)", () => {
    const landingSchema = spec.components.schemas.LandingPage;
    const contentTypes = landingSchema.properties.content_types;
    expect(contentTypes.type).toBe("array");
    expect(contentTypes.items.type).toBe("string");
    expect(contentTypes.items.enum).toEqual(["podcast_episode", "blog_article", "photo"]);
  });

  test("media field surfaces object props", () => {
    const podcastSchema = spec.components.schemas.PodcastEpisode;
    const attachment = podcastSchema.properties.attachment;
    expect(attachment.type).toBe("object");
    expect(attachment.properties).toMatchObject({
      category: {type: "string"},
      url: {type: "string"},
      mime_type: {type: "string"},
      size_in_bytes: {type: "number"},
      duration_in_seconds: {type: "number"},
    });
  });

  test("tags/string_list fields are arrays of strings", () => {
    const blogSchema = spec.components.schemas.BlogArticle;
    expect(blogSchema.properties.tags).toEqual({type: "array", items: {type: "string"}});

    const landingSchema = spec.components.schemas.LandingPage;
    expect(landingSchema.properties.filter_tags).toEqual({type: "array", items: {type: "string"}});
  });

  test("reference field (gallery members) is an array of strings", () => {
    const gallerySchema = spec.components.schemas.Gallery;
    expect(gallerySchema.properties.members).toEqual({type: "array", items: {type: "string"}});
  });

  test("date field maps to integer epoch milliseconds", () => {
    const podcastSchema = spec.components.schemas.PodcastEpisode;
    expect(podcastSchema.properties.date_published_ms).toEqual({
      type: "integer",
      description: "epoch milliseconds",
    });
  });

  test("number field with integer:true maps to integer type", () => {
    const podcastSchema = spec.components.schemas.PodcastEpisode;
    expect(podcastSchema.properties["itunes:season"].type).toBe("integer");
  });

  test("boolean field maps to boolean type", () => {
    const podcastSchema = spec.components.schemas.PodcastEpisode;
    expect(podcastSchema.properties["itunes:block"].type).toBe("boolean");
  });

  test("Tag and Error schemas exist with expected shape", () => {
    expect(spec.components.schemas.Tag).toEqual({
      type: "object",
      properties: {
        id: {type: "string"},
        name: {type: "string"},
        slug: {type: "string"},
      },
    });

    expect(spec.components.schemas.Error).toEqual({
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
    });
  });

  test("paths include the documented item/tag/feed endpoints", () => {
    expect(spec.paths["/api/items"]).toBeDefined();
    expect(spec.paths["/api/items"].post).toBeDefined();

    expect(spec.paths["/api/items/{itemId}"]).toBeDefined();
    expect(spec.paths["/api/items/{itemId}"].get).toBeDefined();
    expect(spec.paths["/api/items/{itemId}"].put).toBeDefined();
    expect(spec.paths["/api/items/{itemId}"].delete).toBeDefined();

    expect(spec.paths["/api/items/{itemId}/restore"].post).toBeDefined();
    expect(spec.paths["/api/items/{itemId}/purge"].post).toBeDefined();

    expect(spec.paths["/api/items/bulk"].post).toBeDefined();

    expect(spec.paths["/api/tags"].get).toBeDefined();
    expect(spec.paths["/api/tags"].post).toBeDefined();
    expect(spec.paths["/api/tags/{tagId}"].put).toBeDefined();
    expect(spec.paths["/api/tags/{tagId}"].delete).toBeDefined();

    expect(spec.paths["/api/feed"].get).toBeDefined();
    expect(spec.paths["/json"].get).toBeDefined();
  });

  test("POST /api/items documents 201 success and 400 error responses", () => {
    const postItems = spec.paths["/api/items"].post;
    expect(postItems.responses["201"]).toBeDefined();
    expect(postItems.responses["400"]).toBeDefined();
    expect(postItems.requestBody).toBeDefined();
  });

  test("POST /api/items/bulk documents request/response shape", () => {
    const bulk = spec.paths["/api/items/bulk"].post;
    expect(bulk.requestBody).toBeDefined();
    expect(bulk.responses["200"]).toBeDefined();
  });

  test("security scheme x-microfeedapi-key is defined as an apiKey header", () => {
    const scheme = spec.components.securitySchemes["x-microfeedapi-key"];
    expect(scheme).toBeDefined();
    expect(scheme.type).toBe("apiKey");
    expect(scheme.in).toBe("header");
    expect(scheme.name).toBe("x-microfeedapi-key");
  });

  test("admin endpoints apply the security requirement", () => {
    const postItems = spec.paths["/api/items"].post;
    expect(postItems.security).toEqual([{"x-microfeedapi-key": []}]);
  });

  test("schema count is registry-driven: equals listTypes().length + fixed extra schemas", () => {
    const schemaNames = Object.keys(spec.components.schemas);
    const typeSchemaNames = listTypes().map((type) => typeNameToSchemaName(type.name));
    const fixedExtraSchemas = ["Tag", "Error", "ItemCreateRequest"];

    for (const name of typeSchemaNames) {
      expect(schemaNames).toContain(name);
    }
    for (const name of fixedExtraSchemas) {
      expect(schemaNames).toContain(name);
    }

    expect(schemaNames.length).toBe(typeSchemaNames.length + fixedExtraSchemas.length);
  });

  test("every field def with kind enum, single-value, surfaces its options directly on the property", () => {
    // Cross-check every type/field against the registry so drift is impossible.
    for (const type of listTypes()) {
      const schemaName = typeNameToSchemaName(type.name);
      const schema = spec.components.schemas[schemaName];
      for (const fieldDef of getFieldDefs(type.name)) {
        expect(schema.properties[fieldDef.key]).toBeDefined();
      }
    }
  });
});
