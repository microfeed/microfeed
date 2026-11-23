import path from "node:path";
import {describe, expect, it} from "vitest";
import {parse, type DefaultTreeAdapterMap} from "parse5";

import {loadThemePackage} from "../../../packages/theme-kit/src/package";
import {standaloneThemePreviewDocument} from "../../../packages/theme-kit/src/cli";
import {BUNDLED_THEME_CATALOG} from "@/shared/themes/BundledThemeCatalog";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
function elements(node: Node): Element[] {
  return ["tagName" in node ? [node] : [],
    "childNodes" in node ? node.childNodes.flatMap(elements) : []].flat();
}
const attribute = (node: Element, name: string) => node.attrs.find(attr => attr.name === name)?.value;
const hasClass = (node: Element, name: string) => attribute(node, "class")?.split(/\s+/).includes(name);
const textContent = (node: Node): string => "value" in node ? node.value :
  "childNodes" in node ? node.childNodes.map(textContent).join("") : "";

describe("public theme tag discovery", () => {
  it("renders a simple tag heading, optional escaped description, and feed back link instead of the feed hero", async () => {
    const tag = {id: "topic", name: "A topic", slug: "topic", description: "<b>Plain text description</b>",
      published_item_count: 0, url: "https://example.test/tags/topic/", rss_url: "https://example.test/tags/topic/rss/", json_url: "https://example.test/tags/topic/json/"};
    const fixture = {version: "https://jsonfeed.org/version/1.1", title: "Channel identity", icon: "https://example.test/cover.png",
      authors: [{name: "Feed author"}], description: "Feed introduction", items: [], _microfeed: {tag, subscribe_methods: [
        {name: "RSS", type: "rss", url: "https://example.test/rss/"},
        {name: "JSON Feed", type: "json", url: "https://example.test/json/"},
      ]}};
    for (const directory of [...BUNDLED_THEME_CATALOG.map(entry => `themes/${entry.directory}`), "packages/theme-kit/assets/starter"]) {
      const theme = await loadThemePackage(path.resolve(directory));
      const html = standaloneThemePreviewDocument(theme, fixture, "tag");
      const nodes = elements(parse(html));
      const header = nodes.find(node => hasClass(node, "mf-tag-header"))!;
      expect(header, directory).toBeDefined();
      const heading = elements(header).find(node => node.tagName === "h1")!;
      expect(textContent(heading), directory).toBe(tag.name);
      expect(elements(header).filter(node => node.tagName === "a").map(node => attribute(node, "href")), directory).toEqual(["/", tag.rss_url, tag.json_url]);
      const headerElements = elements(header);
      const subscriptions = headerElements.find(node => attribute(node, "aria-label") === "Tag feeds")!;
      const description = headerElements.find(node => hasClass(node, "mf-tag-description"))!;
      expect(headerElements.indexOf(subscriptions), directory).toBeLessThan(headerElements.indexOf(description));
      expect(nodes.filter(node => attribute(node, "aria-label") === "Tag feeds"), directory).toHaveLength(1);
      if (directory === "themes/default") {
        expect(textContent(elements(header).find(node => node.tagName === "a")!), directory).toBe(fixture.title);
      }
      expect(textContent(header), directory).toContain(tag.description);
      expect(elements(header).some(node => node.tagName === "img"), directory).toBe(false);
      expect(textContent(header), directory).not.toContain("Feed author");
      expect(html, directory).not.toContain('<h2 class="border-b">About</h2>');
      const withoutDescription = {...fixture, _microfeed: {tag: {...tag, description: ""}}};
      const emptyHeader = elements(parse(standaloneThemePreviewDocument(theme, withoutDescription, "tag")))
        .find(node => hasClass(node, "mf-tag-header"))!;
      expect(elements(emptyHeader).some(node => node.tagName === "p"), directory).toBe(false);
    }
  });

  it("keeps item tags while limiting the bottom discovery section to individual tag pages", async () => {
    const tag = {id: "unicode", name: "世界 <script>", slug: "世界", url: "https://example.test/tags/%E4%B8%96%E7%95%8C/",
      rss_url: "https://example.test/tags/%E4%B8%96%E7%95%8C/rss/", json_url: "https://example.test/tags/%E4%B8%96%E7%95%8C/json/"};
    const fixture = {version: "https://jsonfeed.org/version/1.1", title: "Site", home_page_url: "https://example.test/",
      _microfeed: {subscribe_methods: [
        {name: "RSS", type: "rss", url: "https://example.test/rss/"},
        {name: "JSON Feed", type: "json", url: "https://example.test/json/"},
      ]},
      items: [{id: "one", title: "Tagged item", _microfeed: {tags: [tag], web_url: "https://example.test/i/one/"}}]};
    const directories = [...BUNDLED_THEME_CATALOG.map(entry => `themes/${entry.directory}`), "packages/theme-kit/assets/starter"];
    for (const directory of directories) {
      const theme = await loadThemePackage(path.resolve(directory));
      const itemHtml = standaloneThemePreviewDocument(theme, fixture, "item");
      const itemNodes = elements(parse(itemHtml));
      const itemTags = itemNodes.find(node => hasClass(node, "mf-item-tags"))!;
      expect(itemTags, directory).toBeDefined();
      expect(elements(itemTags).filter(node => node.tagName === "a").map(node => attribute(node, "href")), directory).toEqual([tag.url]);
      if (["themes/default", "themes/podcast", "themes/blog"].includes(directory)) {
        for (const method of fixture._microfeed.subscribe_methods) {
          const subscription = itemNodes.find(node => node.tagName === "a" && attribute(node, "href") === method.url)!;
          expect(subscription, `${directory}:${method.type}`).toBeDefined();
          expect(itemNodes.indexOf(subscription), `${directory}:${method.type}`).toBeLessThan(itemNodes.indexOf(itemTags));
        }
      }
      expect(itemHtml, directory).not.toContain(tag.name);
      expect(itemHtml, directory).toContain("世界 &lt;script&gt;");
      const feedNodes = elements(parse(standaloneThemePreviewDocument(theme, fixture, "feed")));
      const feedMain = feedNodes.find(node => node.tagName === "main")!;
      expect(elements(feedMain).some(node => hasClass(node, "mf-item-tags")), directory).toBe(false);
      const siteNavigation = feedNodes.find(node => attribute(node, "aria-label") === "Site navigation")!;
      expect(elements(siteNavigation).some(node => node.tagName === "a" && attribute(node, "href") === "/tags/"), directory).toBe(false);
      for (const view of ["feed", "item", "page", "search", "tag", "tags"]) {
        const html = standaloneThemePreviewDocument(theme, fixture, view);
        const nodes = elements(parse(html));
        const discovery = nodes.find(node => hasClass(node, "mf-tag-discovery"))!;
        if (view !== "tag") {
          expect(discovery, `${directory}:${view}`).toBeUndefined();
          continue;
        }
        expect(discovery, `${directory}:${view}`).toBeDefined();
        expect(nodes.indexOf(discovery), `${directory}:${view}`).toBeLessThan(nodes.findLastIndex(node => node.tagName === "footer"));
        expect(elements(discovery).filter(node => node.tagName === "a").map(node => attribute(node, "href"))).toEqual(["https://example.test/tags/", tag.url]);
      }
      const empty = elements(parse(standaloneThemePreviewDocument(theme, {...fixture, items: [],
        tags: {items: [], title: "Tags", url: "https://example.test/tags/", rss_enabled: true, json_enabled: true}}, "feed")));
      expect(empty.some(node => hasClass(node, "mf-tag-discovery")), directory).toBe(false);
    }
  });
});
