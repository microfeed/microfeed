import {describe, expect, it} from "vitest";
import {apiItemInputSchema, apiItemOutputSchema, apiWebhookChannelSnapshotSchema, apiWebhookItemSnapshotSchema} from "@/shared/ApiSchemas";
import {webhookChannelSnapshot, webhookItemSnapshot} from "@/shared/WebhookExamples";
import {saveItemDraftInputSchema} from "@/client/webmcp/schemas";
import {OPENAPI_DOCUMENT} from "@/shared/OpenApiDocument";

describe("SEO customization contracts", () => {
  it("shares typed draft editing and API overrides, including clearing", () => {
    const input = {language: "zh-Hans", _microfeed: {slug: "中文", seo: {title: "Search title", description: null}, authors: [{name: "Writer", type: "Person", url: "https://example.com/writer/"}]}};
    expect(saveItemDraftInputSchema.parse(input)).toEqual(apiItemInputSchema.parse(input));
    expect(saveItemDraftInputSchema.parse({_microfeed: {seo: null, authors: null}, language: null}))
      .toEqual({_microfeed: {seo: null, authors: null}, language: null});
    expect(() => saveItemDraftInputSchema.parse({_microfeed: {seo: {canonical_url: "invalid"}}})).toThrow();
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
