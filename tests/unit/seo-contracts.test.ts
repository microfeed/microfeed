import {describe, expect, it} from "vitest";
import {apiItemInputSchema, apiItemOutputSchema, apiWebhookChannelSnapshotSchema, apiWebhookItemSnapshotSchema} from "@/shared/ApiSchemas";
import {webhookChannelSnapshot, webhookItemSnapshot} from "@/shared/WebhookExamples";
import {saveItemDraftInputSchema} from "@/client/webmcp/schemas";
import {defaultSeoDescription} from "@/shared/Seo";
import {OPENAPI_DOCUMENT} from "@/shared/OpenApiDocument";

describe("SEO customization contracts", () => {
  it("shares typed draft editing and API overrides, including clearing", () => {
    const input = {url: "https://example.com/original/", language: "zh-Hans", _microfeed: {slug: "中文", seo: {title: "Search title", description: null}, authors: [{name: "Writer", type: "Person", url: "https://example.com/writer/"}]}};
    expect(saveItemDraftInputSchema.parse(input)).toEqual(apiItemInputSchema.parse(input));
    expect(saveItemDraftInputSchema.parse({_microfeed: {seo: null, authors: null}, language: null}))
      .toEqual({_microfeed: {seo: null, authors: null}, language: null});
    expect(() => saveItemDraftInputSchema.parse({url: "invalid"})).toThrow();
    for (const url of [null, ""]) {
      expect(saveItemDraftInputSchema.parse({url})).toEqual(apiItemInputSchema.parse({url}));
    }
    const document = OPENAPI_DOCUMENT as any;
    expect(document.components.schemas.ItemInput.properties.url).toBeDefined();
    expect(document.components.schemas.ItemMicrofeed.properties.seo.anyOf[0].properties).not.toHaveProperty("canonical_url");
    expect(OPENAPI_DOCUMENT.paths?.["/items/{itemId}/"]?.put?.responses).toHaveProperty("409");
  });

  it("retains standard author names/profile URLs and richer webhook identities", () => {
    const authors = [{name: "Writer", type: "Person" as const, url: "https://example.com/writer/"}];
    const seo = {social_image: {url: "production/images/social.jpg", mime_type: "image/jpeg", width: 1200, height: 630, alt: "Description"}};
    const item = webhookItemSnapshot({id: "example0001", title: "Content title", contentText: "Body", status: 2,
      seo, authorIdentities: authors, language: "ja", publicPath: "/i/日本語/", urlMode: "custom"});
    expect(apiWebhookItemSnapshotSchema.parse(item)).toMatchObject({_microfeed: {seo, authors, slug: "日本語"}, authors: [{name: "Writer", url: authors[0]!.url}]});
    const channel = webhookChannelSnapshot({title: "Channel", publisher: "Publisher", publisherIdentity: {type: "Organization"}, authorIdentities: authors, seo});
    expect(apiWebhookChannelSnapshotSchema.parse(channel)).toMatchObject({_microfeed: {seo, publisher: {name: "Publisher", type: "Organization"}, authors}, authors: [{name: "Writer", url: authors[0]!.url}]});
    expect(apiItemOutputSchema.parse({id: "example0001", content_text: "Body", authors: [{name: "Writer", url: authors[0]!.url}]}).authors)
      .toEqual([{name: "Writer", url: authors[0]!.url}]);
  });
});

describe("canonical item links", () => {
  it("normalizes web links and removes fragments while rejecting unsafe legacy values", async () => {
    const {canonicalItemLink} = await import("@/shared/Seo");
    const local = "https://example.com/i/local/";
    expect(canonicalItemLink("https://source.example/中文?q=1#section", local))
      .toBe("https://source.example/%E4%B8%AD%E6%96%87?q=1");
    expect(canonicalItemLink("/i/other/", local)).toBe("https://example.com/i/other/");
    for (const link of [null, undefined, "", "  ", "not-a-url", "https:", "javascript:alert(1)", "mailto:writer@example.com", "https://user:secret@example.com/", "http://["]) {
      expect(canonicalItemLink(link, local)).toBeUndefined();
    }
  });
});

describe("automatic SEO description", () => {
  it("compacts whitespace and truncates by Unicode code points including the ellipsis", () => {
    expect(defaultSeoDescription("  One\n\n two\tthree  ")).toBe("One two three");
    expect(defaultSeoDescription("x".repeat(160))).toBe("x".repeat(160));
    const description = defaultSeoDescription("😀中文".repeat(1000));
    expect(Array.from(description)).toHaveLength(160);
    expect(description).toBe("😀中文".repeat(53) + "…");
    expect(defaultSeoDescription("2 < 3 and 4 > 1")).toBe("2 < 3 and 4 > 1");
  });
});
