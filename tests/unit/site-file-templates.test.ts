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

  it("validates Mustache syntax and escapes variables by default", () => {
    expect(validateSiteFileTemplateSource("{{#items}}unfinished"))
      .toContain("Invalid Mustache template");
    expect(validateSiteFileTemplateSource("Title: {{title}}"))
      .toBeUndefined();
    expect(renderSiteFileTemplate("{{title}}", {title: "A & B"}))
      .toBe("A &amp; B");
  });
});
