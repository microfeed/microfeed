/** @jest-environment jsdom */
import React from "react";
import {render} from "@testing-library/react";
import MetaTags from "./MetaTags";
import JsonLd from "./JsonLd";

function renderToDom(element) {
  const {container} = render(element);
  return container;
}

const BASE_SEO = {
  title: "Hello World",
  description: "A short description.",
  canonicalUrl: "https://example.com/blog/hello-world/",
  ogType: "article",
  image: "https://cdn.example.com/cover.png",
  siteName: "Test Site",
  twitterHandle: "@testorg",
  keywords: ["news", "tech"],
  noindex: false,
  publishedTime: "2024-01-15T00:00:00.000Z",
  modifiedTime: "2024-01-16T00:00:00.000Z",
  author: "Ada Lovelace",
  section: "Blog",
  tags: ["news", "tech"],
  jsonLd: {"@context": "https://schema.org", "@type": "BlogPosting", headline: "Hello World"},
};

describe("MetaTags", () => {
  test("renders OG tags with correct content", () => {
    const container = renderToDom(<MetaTags seo={BASE_SEO} />);
    const get = (prop) => container.querySelector(`meta[property="${prop}"]`);
    expect(get("og:title").getAttribute("content")).toBe("Hello World");
    expect(get("og:description").getAttribute("content")).toBe("A short description.");
    expect(get("og:image").getAttribute("content")).toBe("https://cdn.example.com/cover.png");
    expect(get("og:url").getAttribute("content")).toBe("https://example.com/blog/hello-world/");
    expect(get("og:type").getAttribute("content")).toBe("article");
    expect(get("og:site_name").getAttribute("content")).toBe("Test Site");
  });

  test("renders Twitter tags with summary_large_image + site/creator", () => {
    const container = renderToDom(<MetaTags seo={BASE_SEO} />);
    const get = (name) => container.querySelector(`meta[name="${name}"]`);
    expect(get("twitter:card").getAttribute("content")).toBe("summary_large_image");
    expect(get("twitter:site").getAttribute("content")).toBe("@testorg");
    expect(get("twitter:creator").getAttribute("content")).toBe("@testorg");
    expect(get("twitter:title").getAttribute("content")).toBe("Hello World");
    expect(get("twitter:description").getAttribute("content")).toBe("A short description.");
    expect(get("twitter:image").getAttribute("content")).toBe("https://cdn.example.com/cover.png");
  });

  test("renders article:* tags for blog/podcast pages", () => {
    const container = renderToDom(<MetaTags seo={BASE_SEO} />);
    const get = (prop) => container.querySelector(`meta[property="${prop}"]`);
    expect(get("article:published_time").getAttribute("content")).toBe("2024-01-15T00:00:00.000Z");
    expect(get("article:modified_time").getAttribute("content")).toBe("2024-01-16T00:00:00.000Z");
    expect(get("article:author").getAttribute("content")).toBe("Ada Lovelace");
    expect(get("article:section").getAttribute("content")).toBe("Blog");
    const tagEls = container.querySelectorAll('meta[property="article:tag"]');
    expect(tagEls).toHaveLength(2);
  });

  test("renders meta[name=keywords] from seo.keywords", () => {
    const container = renderToDom(<MetaTags seo={BASE_SEO} />);
    const keywordsEl = container.querySelector('meta[name="keywords"]');
    expect(keywordsEl.getAttribute("content")).toBe("news, tech");
  });

  test("renders meta[name=robots] noindex,nofollow when noindex true", () => {
    const container = renderToDom(<MetaTags seo={{...BASE_SEO, noindex: true}} />);
    const robots = container.querySelector('meta[name="robots"]');
    expect(robots.getAttribute("content")).toBe("noindex,nofollow");
  });

  test("omits noindex or renders index,follow when noindex false", () => {
    const container = renderToDom(<MetaTags seo={BASE_SEO} />);
    const robots = container.querySelector('meta[name="robots"]');
    if (robots) {
      expect(robots.getAttribute("content")).toBe("index,follow");
    } else {
      expect(robots).toBeNull();
    }
  });

  test("does not render article:* tags for non-article ogType", () => {
    const container = renderToDom(<MetaTags seo={{...BASE_SEO, ogType: "website", author: undefined, section: undefined, tags: []}} />);
    expect(container.querySelector('meta[property="article:published_time"]')).toBeNull();
  });
});

describe("JsonLd", () => {
  test("renders a script[type=application/ld+json] whose content parses as valid JSON with expected @type", () => {
    const seo = {jsonLd: {"@context": "https://schema.org", "@type": "BlogPosting", headline: "Hello"}};
    const container = renderToDom(<JsonLd seo={seo} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    const parsed = JSON.parse(script.textContent);
    expect(parsed["@type"]).toBe("BlogPosting");
    expect(parsed.headline).toBe("Hello");
  });

  test("escapes </ sequences to prevent script breakout", () => {
    const seo = {jsonLd: {"@type": "BlogPosting", description: "Bad</script><script>alert(1)</script>"}};
    const container = renderToDom(<JsonLd seo={seo} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    const rawContent = script.textContent;
    // The escaped serialized form must not contain a literal "</script" that
    // could break out of the script tag.
    expect(rawContent).not.toContain("</script>");
    expect(rawContent).toContain("<\\/script");
    // Unescaping should still round-trip to the original value.
    const parsed = JSON.parse(rawContent.replace(/<\\\//g, "</"));
    expect(parsed.description).toBe("Bad</script><script>alert(1)</script>");
  });

  test("renders the BreadcrumbList as a separate second ld+json script (no @graph)", () => {
    const seo = {
      jsonLd: {"@context": "https://schema.org", "@type": "BlogPosting", headline: "Hello"},
      breadcrumb: {"@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: []},
    };
    const container = renderToDom(<JsonLd seo={seo} />);
    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts.length).toBe(2);
    const types = [...scripts].map((s) => JSON.parse(s.textContent)["@type"]);
    expect(types).toEqual(["BlogPosting", "BreadcrumbList"]);
    // No redundant @graph on the primary node.
    expect(JSON.parse(scripts[0].textContent)["@graph"]).toBeUndefined();
  });

  test("renders only the primary script when there is no breadcrumb", () => {
    const seo = {jsonLd: {"@context": "https://schema.org", "@type": "WebSite", name: "S"}};
    const container = renderToDom(<JsonLd seo={seo} />);
    expect(container.querySelectorAll('script[type="application/ld+json"]').length).toBe(1);
  });
});
