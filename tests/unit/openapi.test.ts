import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

import {describe, expect, it} from "vitest";
import YAML from "yaml";

import {
  apiChannelInputSchema,
  apiItemInputSchema,
  apiUploadInputSchema,
} from "@/shared/ApiSchemas";
import {OPENAPI_DOCUMENT} from "@/shared/OpenApiDocument";
import {MICROFEED_VERSION} from "@/shared/Version";
import {API_BASE_PATH, API_MAJOR_VERSION} from "@/shared/ApiVersion";
import {WEBHOOK_EVENT_TYPES} from "@/shared/Webhooks";
import {
  JAVASCRIPT_WEBHOOK_RECEIVER,
  PYTHON_WEBHOOK_RECEIVER,
} from "@/shared/WebhookQuickstarts";
import {
  API_LLMS_FULL_TEXT,
  OPENAPI_JSON,
  OPENAPI_YAML,
} from "@/server/openapi/document";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

describe("generated API reference", () => {
  it("generates JSON, YAML, Scalar, and LLM input from one document", async () => {
    expect(JSON.parse(OPENAPI_JSON)).toEqual(OPENAPI_DOCUMENT);
    expect(OPENAPI_YAML).toContain("openapi: 3.1.1");
    expect(OPENAPI_DOCUMENT.info.version).toBe(MICROFEED_VERSION);
    expect(OPENAPI_DOCUMENT.servers).toEqual([{
      description: "This microfeed instance API",
      url: API_BASE_PATH,
    }]);
    expect(Number(MICROFEED_VERSION.split(".")[0])).toBe(API_MAJOR_VERSION);
    expect(OPENAPI_DOCUMENT.webhooks?.microfeedEvent?.post?.operationId)
      .toBe("receiveMicrofeedWebhook");
    expect(JSON.stringify(OPENAPI_DOCUMENT.webhooks)).toContain("webhook-signature");
    expect(JSON.stringify(OPENAPI_DOCUMENT.webhooks)).toContain("item.published");
    const webhookOperation = OPENAPI_DOCUMENT.webhooks?.microfeedEvent?.post as
      | {"x-codeSamples"?: Array<{lang: string; source: string}>}
      | undefined;
    expect(webhookOperation?.["x-codeSamples"]).toEqual([
      expect.objectContaining({lang: "JavaScript", source: JAVASCRIPT_WEBHOOK_RECEIVER}),
      expect.objectContaining({lang: "Python", source: PYTHON_WEBHOOK_RECEIVER}),
    ]);
    const webhookRequestBody = OPENAPI_DOCUMENT.webhooks?.microfeedEvent?.post
      ?.requestBody as {
        content?: {"application/json"?: {examples?: Record<string, {value?: any}>}};
      } | undefined;
    const examples = webhookRequestBody?.content?.["application/json"]?.examples;
    expect(Object.keys(examples ?? {})).toEqual([...WEBHOOK_EVENT_TYPES]);
    for (const type of WEBHOOK_EVENT_TYPES) {
      expect(examples?.[type]?.value).toMatchObject({test: true, type});
    }
    const componentSchemas = OPENAPI_DOCUMENT.components?.schemas ?? {};
    expect(componentSchemas).toHaveProperty("WebhookItemSnapshot");
    expect(componentSchemas).toHaveProperty("WebhookPageNavigationSnapshot");
    expect(componentSchemas).toHaveProperty("WebhookThemeSnapshot");
    expect(API_LLMS_FULL_TEXT).toContain("microfeedEvent");
    expect(API_LLMS_FULL_TEXT).toContain("const {Webhook} = require");
    expect(API_LLMS_FULL_TEXT).toContain("from standardwebhooks.webhooks import Webhook");
    expect(API_LLMS_FULL_TEXT).toContain("Authorization: Bearer YOUR_CREDENTIAL");
    expect(
      OPENAPI_DOCUMENT.paths?.["/site-files/preview/"]?.post?.description,
    ).toContain("up to 100 newest Published items");
    expect(
      OPENAPI_DOCUMENT.paths?.["/site-files/preview/"]?.post?.description,
    ).toContain("up to 100 most recently updated Published Pages");

    const embeddedContract = API_LLMS_FULL_TEXT.match(
      /```yaml\n([\s\S]+)\n```/u,
    )?.[1];
    expect(embeddedContract).toBeDefined();
    expect(YAML.parse(embeddedContract ?? "")).toEqual(OPENAPI_DOCUMENT);

    const scalar = await readFile(
      path.join(repositoryRoot, "src", "components", "api", "ApiReference.tsx"),
      "utf8",
    );
    expect(scalar).toContain('@scalar/api-reference-react/style.css');
    expect(scalar).toContain("content: interactiveDocument");
    expect(scalar).toContain("customCss: SCALAR_LAYOUT_CSS");
    expect(scalar).not.toContain("servers: [{");
    expect(scalar).toContain("defaultOpenAllTags: true");
    expect(scalar).toContain("defaultOpenFirstTag: true");
    expect(scalar).toContain("expandAllModelSections: true");
    expect(scalar).toContain("expandAllResponses: true");
    expect(scalar).toContain("grid-area: navigation");
    expect(scalar).toContain("scalar-reference-page-sidebar");
    expect(scalar).toContain("position: static");
    expect(scalar).toContain("hideClientButton: true");
    expect(scalar).toContain("hideDarkModeToggle: followDocumentColorMode");
    expect(scalar).toContain('pinSidebarFooterToPageBottom ? "scalar-reference-page-sidebar"');
    expect(scalar).toContain("persistAuth: false");
    expect(scalar).toContain('showDeveloperTools: "never"');
    expect(scalar).toContain("showSidebar: true");
    expect(scalar).toContain("telemetry: false");
    expect(scalar).toContain("withDefaultFonts: false");
    expect(scalar).toContain("mcp: {disabled: true}");
    expect(scalar).not.toMatch(/cdn\.|googleapis|unpkg/iu);

    const explorer = await readFile(
      path.join(repositoryRoot, "src", "components", "admin", "api", "ApiExplorerApp.tsx"),
      "utf8",
    );
    expect(explorer).toContain("followDocumentColorMode");
    expect(explorer).toContain("pinSidebarFooterToPageBottom");

    const htmlReferences = await Promise.all([
      "src/pages/api/v1/index.astro",
      "src/pages/api/v1/openapi.html.astro",
    ].map((filename) => readFile(
      path.join(repositoryRoot, filename),
      "utf8",
    )));
    for (const htmlReference of htmlReferences) {
      expect(htmlReference).toContain("ApiReferencePage");
      expect(htmlReference).not.toContain("Response.redirect");
    }
  });

  it("keeps Admin and OpenAPI receiver code synchronized with scaffold templates", async () => {
    const [javascript, python] = await Promise.all([
      readFile(path.join(
        repositoryRoot,
        "packages/cli/templates/webhook/javascript/server.cjs",
      ), "utf8"),
      readFile(path.join(
        repositoryRoot,
        "packages/cli/templates/webhook/python/server.py",
      ), "utf8"),
    ]);
    expect(javascript.replaceAll(/\r\n?/gu, "\n"))
      .toBe(JAVASCRIPT_WEBHOOK_RECEIVER.replaceAll(/\r\n?/gu, "\n"));
    expect(python.replaceAll(/\r\n?/gu, "\n"))
      .toBe(PYTHON_WEBHOOK_RECEIVER.replaceAll(/\r\n?/gu, "\n"));
  });

  it("makes the full LLM reference self-contained", () => {
    expect(API_LLMS_FULL_TEXT).toContain("self-contained API reference");
    expect(API_LLMS_FULL_TEXT).toContain("## Complete endpoint contract");

    for (const pathname of Object.keys(OPENAPI_DOCUMENT.paths ?? {})) {
      expect(API_LLMS_FULL_TEXT).toContain(pathname);
    }

    expect(API_LLMS_FULL_TEXT).toContain("parameters:");
    expect(API_LLMS_FULL_TEXT).toContain("requestBody:");
    expect(API_LLMS_FULL_TEXT).toContain("responses:");
    expect(API_LLMS_FULL_TEXT).toContain("schemas:");
    expect(API_LLMS_FULL_TEXT).toContain("name: next_cursor");
    expect(API_LLMS_FULL_TEXT).toContain("UploadResponse:");
    expect(API_LLMS_FULL_TEXT).toContain("RSS enclosure");
    expect(API_LLMS_FULL_TEXT).toContain("JSON Feed attachments[0]");
  });

  it("documents only current routes and Bearer authentication", () => {
    const specification = JSON.stringify(OPENAPI_DOCUMENT);
    expect(Object.keys(OPENAPI_DOCUMENT.paths ?? {})).toEqual([
      "/feed/",
      "/items/",
      "/items/validate/",
      "/items/{itemId}/",
      "/pages/",
      "/pages/validate/",
      "/pages/{pageId}/",
      "/site-files/",
      "/site-files/validate/",
      "/site-files/preview/",
      "/site-files/{siteFileId}/",
      "/site-files/{siteFileId}/publish/",
      "/site-files/{siteFileId}/reset/",
      "/search/",
      "/channels/{channelId}/",
      "/media_files/presigned_urls/",
    ]);
    expect(OPENAPI_DOCUMENT.servers?.[0]?.url).toBe(API_BASE_PATH);
    expect(API_LLMS_FULL_TEXT).toContain(
      `The API base path is ${API_BASE_PATH}`,
    );
    expect(API_LLMS_FULL_TEXT).not.toContain("/api/feed/");
    expect(specification).toContain("bearerAuth");
    expect(specification).not.toContain("oauth2");
    expect(specification).not.toContain("content:read");
    expect(specification).not.toContain("content:write");
    expect(specification).not.toContain("legacyApiKey");
    expect(specification).not.toContain("X-MicrofeedAPI-Key");
    expect(API_LLMS_FULL_TEXT).not.toContain("legacyApiKey");
    expect(API_LLMS_FULL_TEXT).not.toContain("X-MicrofeedAPI-Key");
  });

  it("accepts canonical and compatibility request fields", () => {
    expect(apiChannelInputSchema.safeParse({
      homepage_url: "https://example.com/",
    }).success).toBe(true);
    expect(apiChannelInputSchema.safeParse({
      home_page_url: "https://example.com/",
    }).success).toBe(true);
    expect(apiChannelInputSchema.safeParse({
      _microfeed: {
        copyright: "© {{current_year}} Example Publisher",
      },
    }).success).toBe(true);
    expect(apiItemInputSchema.safeParse({
      attachments: [{
        category: "audio",
        size_in_byte: 123,
        url: "https://example.com/audio.mp3",
      }],
    }).success).toBe(true);
    expect(apiUploadInputSchema.safeParse({
      category: "audio",
      full_local_file_path: "/tmp/episode.mp3",
      item_id: "0HGJLSML3P1",
    }).success).toBe(true);
    expect(apiItemInputSchema.safeParse({
      attachments: [{
        category: "image",
        mime_type: "image/png",
        size_in_bytes: 456,
        url: "https://example.com/original.png",
      }],
      image: "https://example.com/cover.png",
    }).success).toBe(true);
  });

  it("documents safe validation and idempotent item creation", () => {
    const specification = JSON.stringify(OPENAPI_DOCUMENT);
    expect(specification).toContain("Idempotency-Key");
    expect(specification).toContain("Idempotency-Replayed");
    expect(specification).toContain("/items/validate/");
    expect(specification).toContain("ItemValidationResponse");
    expect(OPENAPI_DOCUMENT.paths?.["/items/"]?.post?.responses)
      .toHaveProperty("409");
  });

  it("accepts automation context on every persistent mutating operation", () => {
    const operations = [
      ["/items/", "post"],
      ["/items/{itemId}/", "put"],
      ["/items/{itemId}/", "delete"],
      ["/pages/", "post"],
      ["/pages/{pageId}/", "put"],
      ["/pages/{pageId}/", "delete"],
      ["/site-files/", "post"],
      ["/site-files/{siteFileId}/", "put"],
      ["/site-files/{siteFileId}/", "delete"],
      ["/site-files/{siteFileId}/publish/", "post"],
      ["/site-files/{siteFileId}/reset/", "post"],
      ["/channels/{channelId}/", "put"],
      ["/media_files/presigned_urls/", "post"],
    ] as const;

    for (const [pathname, method] of operations) {
      const operation = OPENAPI_DOCUMENT.paths?.[pathname]?.[method];
      const serialized = JSON.stringify(operation?.parameters ?? []);
      expect(serialized, `${method.toUpperCase()} ${pathname}`)
        .toContain("Microfeed-Correlation-Id");
      expect(serialized, `${method.toUpperCase()} ${pathname}`)
        .toContain("Microfeed-Causation-Id");
    }
  });

  it("keeps Page navigation order out of individual Page inputs", () => {
    const createInput = OPENAPI_DOCUMENT.components?.schemas
      ?.PageCreateInput as {properties?: Record<string, unknown>};
    const pageOutput = OPENAPI_DOCUMENT.components?.schemas
      ?.Page as {properties?: Record<string, unknown>};

    expect(createInput.properties).not.toHaveProperty("navigation_order");
    expect(pageOutput.properties).toHaveProperty("navigation_order");
  });

  it("documents when Page navigation settings take effect", () => {
    const pageInput = OPENAPI_DOCUMENT.components?.schemas?.PageInput as {
      properties?: Record<string, {description?: string}>;
    };
    const pageOutput = OPENAPI_DOCUMENT.components?.schemas?.Page as {
      properties?: Record<string, {description?: string}>;
    };

    for (const schema of [pageInput, pageOutput]) {
      expect(schema.properties?.show_in_navigation?.description)
        .toContain("only active when status is published");
      expect(schema.properties?.show_in_navigation?.description)
        .toContain("stored but ignored until the Page is published");
      expect(schema.properties?.show_in_navigation?.description)
        .toContain("unlisted Page, it is always forced to false");
    }
  });

  it("documents resolved current-year copyright output", () => {
    const specification = JSON.stringify(OPENAPI_DOCUMENT);
    expect(specification).toContain("{{current_year}}");
    expect(specification).toContain("current UTC year");
    expect(specification).toContain("Rendered channel copyright");
  });

  it("defines search items as Item plus highlights", () => {
    const searchItem = OPENAPI_DOCUMENT.components?.schemas?.SearchItem as {
      allOf?: unknown[];
    };
    expect(searchItem.allOf?.[0]).toEqual({
      $ref: "#/components/schemas/Item",
    });
    expect(searchItem.allOf?.[1]).toMatchObject({
      properties: {
        highlights: {
          required: ["content_text", "title"],
        },
      },
      required: ["type", "highlights"],
    });
  });
});
