import {describe, expect, it} from "vitest";
import {manifestWithTagTemplates, tagDirectoryContext, tagPreviewContexts, tagsTemplate} from "@/shared/themes/ThemeTags";
import {renderThemeTemplate, themeContext} from "@/shared/themes/ThemeRenderer";
import {themeContextSchema, themeTagDirectorySchema} from "@/shared/themes/ThemeContract";
import {BUNDLED_FALLBACK_THEME} from "@/shared/themes/BundledThemeCatalog";

describe("tag theme context", () => {
  const tag = {id: "world", name: "世界 <b>", slug: "世界", description: "<script>plain text</script>", published_item_count: 0,
    url: "https://example.test/tags/%E4%B8%96%E7%95%8C/", rss_url: "https://example.test/tags/%E4%B8%96%E7%95%8C/rss/", json_url: "https://example.test/tags/%E4%B8%96%E7%95%8C/json/"};

  it("renders escaped directory text, pagination, and feed-setting flags", () => {
    const tags = tagDirectoryContext([tag], "https://example.test/tags/", {nextUrl: "https://example.test/tags/?next_cursor=next", rssEnabled: false});
    expect(themeTagDirectorySchema.parse(tags)).toEqual(tags);
    const html = renderThemeTemplate(tagsTemplate({}), {tags});
    expect(html).toContain("世界 &lt;b&gt;");
    expect(html).toContain("&lt;script&gt;plain text&lt;&#x2F;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('>RSS</a>');
    expect(html).toContain('>JSON Feed</a>');
    expect(html).toContain("0 published items");
    expect(html).toContain("next_cursor");
    expect(renderThemeTemplate(tagsTemplate({}), {tags: tagDirectoryContext([], "/tags/")})).toContain("No tags yet.");
  });

  it("uses supplied tag fixtures and clears archive-only context for directory previews", () => {
    const context = themeContext({items: [], version: "https://jsonfeed.org/version/1.1", title: "Site identity",
      _microfeed: {base_url: "https://example.test", categories: [], microfeed_version: "preview", tag, subscribe_methods: [{name: "RSS", type: "rss", url: "/rss/"}]},
      tags: tagDirectoryContext([], "/tags/", {jsonEnabled: false})}, {assetBaseUrl: "", packageId: "test.theme", version: "1.0.0"});
    const {tagContext, tagsContext} = tagPreviewContexts(context);
    expect(themeContextSchema.safeParse(tagContext).success).toBe(true);
    expect(themeContextSchema.safeParse(tagsContext).success).toBe(true);
    expect(tagContext).toMatchObject({title: tag.name, home_page_url: tag.url, _microfeed: {tag, subscribe_methods: [{url: tag.rss_url}]}});
    expect(tagsContext).toMatchObject({title: "Site identity", tags: {items: [], json_enabled: false}});
    expect(tagsContext._microfeed?.tag).toBeUndefined();
  });

  it("adds and removes only optional manifest entries while preserving inherited paths", () => {
    const manifest = {...BUNDLED_FALLBACK_THEME.manifest};
    manifest.files = {...manifest.files};
    manifest.files.webTag = "custom/archive.html";
    const bundle = {assets: [], rssStylesheet: "", webBodyEnd: "", webBodyStart: "", webFeed: "", webHeader: "", webItem: "", webTag: "", webTags: ""};
    const custom = manifestWithTagTemplates(manifest, bundle);
    expect(custom.files).toMatchObject({webTag: "custom/archive.html", webTags: "web-tags.mustache", webFeed: manifest.files.webFeed});
    const fallback = manifestWithTagTemplates(custom, {...bundle, webTag: undefined, webTags: undefined});
    expect(fallback.files).not.toHaveProperty("webTag");
    expect(fallback.files).not.toHaveProperty("webTags");
    expect(fallback.files.webFeed).toBe(manifest.files.webFeed);
    const recreated = manifestWithTagTemplates(fallback, bundle, custom);
    expect(recreated.files.webTag).toBe("custom/archive.html");
    expect(recreated.files.webTags).toBe("web-tags.mustache");
  });

  it("keeps archive pagination on tag routes without changing item URLs", () => {
    const context = themeContext({items: [{id: "item", url: "https://example.test/i/item/"}],
      next_url: "https://example.test/json/?next_cursor=next",
      _microfeed: {base_url: "https://example.test", prev_url: "https://example.test/?prev_cursor=previous"}},
    {assetBaseUrl: "", packageId: "test.theme", version: "1.0.0"});
    const {tagContext} = tagPreviewContexts(context);
    expect(tagContext._microfeed).toMatchObject({
      next_url: "https://example.test/tags/featured/?next_cursor=next",
      prev_url: "https://example.test/tags/featured/?prev_cursor=previous",
    });
    expect(tagContext.items).toEqual(context.items);
  });
});
