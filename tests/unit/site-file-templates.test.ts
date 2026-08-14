import {describe, expect, it} from "vitest";

import {
  defaultSiteFileTemplate,
  renderSiteFileTemplate,
  validateSiteFileTemplateSource,
} from "@/shared/SiteFileTemplates";

describe("Site File templates", () => {
  it("ships editable Mustache source for every generated file", () => {
    expect(defaultSiteFileTemplate("robots")).toContain("_site.sitemap_url");
    expect(defaultSiteFileTemplate("llms")).toContain("{{#pages}}");
    expect(defaultSiteFileTemplate("sitemap")).toContain("{{#items}}");
  });

  it("identifies microfeed and conditionally links the instance API guide", () => {
    const template = defaultSiteFileTemplate("llms")!;
    const baseContext = {
      _microfeed: {description_text: "A useful site."},
      _site: {
        has_items: false,
        has_pages: false,
        json_feed_url: "https://example.com/json/",
        rss_feed_url: "https://example.com/rss/",
      },
      home_page_url: "https://example.com/",
      title: "Example",
    };

    const withoutApi = renderSiteFileTemplate(template, baseContext);
    expect(withoutApi).toContain(
      "[microfeed](https://github.com/microfeed/microfeed), an agentic CMS on Cloudflare",
    );
    expect(withoutApi).toContain("<https://docs.microfeed.org/>");
    expect(withoutApi).not.toContain("/api/llms-full.txt");

    const withApi = renderSiteFileTemplate(template, {
      ...baseContext,
      _site: {
        ...baseContext._site,
        api_llms_full_url: "https://example.com/api/llms-full.txt",
      },
    });
    expect(withApi).toContain(
      "<https://example.com/api/llms-full.txt>",
    );
  });

  it("validates Mustache syntax and escapes variables by default", () => {
    expect(validateSiteFileTemplateSource("{{#items}}unfinished"))
      .toContain("Invalid Mustache template");
    expect(validateSiteFileTemplateSource("Title: {{title}}"))
      .toBeUndefined();
    expect(renderSiteFileTemplate("{{title}}", {title: "A & B"}))
      .toBe("A &amp; B");
  });
});
