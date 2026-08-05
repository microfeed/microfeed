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
      url: "/api/",
    }]);
    expect(API_LLMS_FULL_TEXT).toContain("Authorization: Bearer YOUR_API_KEY");

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
    expect(scalar).toContain("content: document");
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
  });

  it("documents only current routes and Bearer authentication", () => {
    const specification = JSON.stringify(OPENAPI_DOCUMENT);
    expect(Object.keys(OPENAPI_DOCUMENT.paths ?? {})).toEqual([
      "/feed/",
      "/items/",
      "/items/{itemId}/",
      "/channels/{channelId}/",
      "/media_files/presigned_urls/",
    ]);
    expect(specification).not.toContain("/api/v1/");
    expect(specification).toContain("bearerAuth");
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
  });
});
