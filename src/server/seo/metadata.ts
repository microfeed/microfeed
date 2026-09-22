import {htmlToPlainText} from "@/shared/StringUtils";
import type {Identity, PublisherIdentity, Seo, SocialImage} from "@/shared/Seo";

type Content = Record<string, any>;

const escapeAttribute = (text: string) => text.replace(/[&<>"']/gu, (character) =>
  ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[character]!);
const summary = (text: string) => Array.from(htmlToPlainText(text)).slice(0, 320).join("");

export function effectiveSocialImage(feed: Content, item?: Content): Partial<SocialImage> | undefined {
  return item?._microfeed?.seo?.social_image || (item?.image ? {url: item.image} : undefined) ||
    feed._microfeed?.seo?.social_image || (feed.icon ? {url: feed.icon} : undefined);
}

export function hasOtherCanonical(item: Content): boolean {
  const canonical = item._microfeed?.seo?.canonical_url;
  if (!canonical) return false;
  try { return new URL(canonical).href !== new URL(item._microfeed.web_url).href; } catch { return false; }
}

function identity(value: Identity | PublisherIdentity) {
  return {
    ...(value.type ? {"@type": value.type} : {}),
    name: value.name,
    ...(value.url ? {url: value.url} : {}),
    ...("same_as" in value && value.same_as?.length ? {sameAs: value.same_as} : {}),
  };
}

export interface MetadataInput {
  feed: Content;
  item?: Content;
  origin: string;
  headHtml: string;
}

/** One resolver owns generated metadata and precedence for both public editors. */
export async function resolveMetadata({feed, item, origin, headHtml}: MetadataInput) {
  const seo: Seo = (item ?? feed)._microfeed?.seo ?? {};
  const localUrl = item?._microfeed?.web_url ?? new URL("/", origin).href;
  let canonical = seo.canonical_url || localUrl;
  const title = seo.title || item?.title || feed.title || "Untitled";
  const description = seo.description || summary(item?.content_text ?? feed._microfeed?.description_text ?? feed.description ?? "");
  const language = item?.language || feed.language || "en";
  const inheritedImage = effectiveSocialImage(feed, item);
  const image = inheritedImage?.url ? {...inheritedImage, url: new URL(inheritedImage.url, origin).href} : undefined;
  const defaults = new Map<string, string>([
    ["title", title], ["description", description], ["canonical", canonical],
    ["og:title", title], ["og:description", description], ["og:url", canonical],
    ["og:type", item ? "article" : "website"], ["og:site_name", feed.title || ""],
    ["twitter:card", image ? "summary_large_image" : "summary"],
    ["twitter:title", title], ["twitter:description", description],
  ]);
  if (image?.url) {
    defaults.set("og:image", image.url);
    defaults.set("twitter:image", image.url);
    for (const field of ["width", "height", "mime_type", "alt"] as const) {
      if (image[field]) defaults.set(`og:image:${field === "mime_type" ? "type" : field}`, String(image[field]));
    }
    if (image.alt) defaults.set("twitter:image:alt", image.alt);
  }
  const explicit = new Set<string>();
  if (seo.title) ["title", "og:title", "twitter:title"].forEach((key) => explicit.add(key));
  if (seo.description) ["description", "og:description", "twitter:description"].forEach((key) => explicit.add(key));
  if (seo.canonical_url) ["canonical", "og:url"].forEach((key) => explicit.add(key));
  if (seo.social_image || (!item?.image && feed._microfeed?.seo?.social_image)) {
    ["og:image", "og:image:width", "og:image:height", "og:image:type", "og:image:alt", "twitter:image", "twitter:image:alt", "twitter:card"]
      .forEach((key) => explicit.add(key));
  }
  const unlisted = item?._microfeed?.status === "unlisted";
  if (unlisted) { defaults.set("robots", "noindex"); explicit.add("robots"); }
  const managed = new Set([...defaults.keys(), "og:image", "og:image:width", "og:image:height",
    "og:image:type", "og:image:alt", "twitter:image", "twitter:image:alt"]);
  const seen = new Set<string>();
  const cleaned = await new HTMLRewriter().on("title, meta, link", {
    element(element) {
      const tag = element.tagName.toLowerCase();
      const key = tag === "title" ? "title" : tag === "link"
        ? (element.getAttribute("rel")?.toLowerCase() === "canonical" ? "canonical" : "")
        : (element.getAttribute("property") ?? element.getAttribute("name") ?? "").toLowerCase();
      if (unlisted && (key === "googlebot" || key === "bingbot")) { element.remove(); return; }
      if (!managed.has(key)) return;
      if (explicit.has(key) || seen.has(key)) { element.remove(); return; }
      seen.add(key);
      defaults.delete(key);
      if (key === "canonical") {
        const value = element.getAttribute("href");
        if (value) {
          try { const parsed = new URL(value, origin); if (/^https?:$/u.test(parsed.protocol)) canonical = parsed.href; } catch { /* Keep local fallback. */ }
        }
      }
    },
  }).transform(new Response(headHtml)).text();
  // A custom canonical also informs generated URLs, unless that tag is custom itself.
  if (defaults.has("og:url")) defaults.set("og:url", canonical);
  const tags = [...defaults].filter(([, value]) => value).map(([key, value]) => {
    const escaped = escapeAttribute(value);
    if (key === "title") return `<title>${escaped}</title>`;
    if (key === "canonical") return `<link rel="canonical" href="${escaped}">`;
    return `<meta ${key.startsWith("og:") ? "property" : "name"}="${key}" content="${escaped}">`;
  }).join("\n");

  const publisher = feed._microfeed?.publisher as PublisherIdentity | undefined;
  const configuredPublisher = publisher && (publisher.type || publisher.url || publisher.same_as?.length)
    ? identity(publisher) : undefined;
  const authors: Identity[] = item?._microfeed?.authors?.length
    ? item._microfeed.authors : feed._microfeed?.authors ?? [];
  const common = {
    url: canonical, name: item?.title || feed.title, inLanguage: language,
    ...(image?.url ? {image: image.url} : {}),
    ...(configuredPublisher ? {publisher: configuredPublisher} : {}),
    ...(item && authors.length ? {author: authors.map(identity)} : {}),
  };
  const graph: Content[] = item ? [{
    "@type": "WebPage", "@id": `${canonical}#webpage`, ...common,
    ...(item.date_published ? {datePublished: item.date_published} : {}),
    ...(item.date_modified ? {dateModified: item.date_modified} : {}),
  }] : [{"@type": "WebSite", "@id": `${canonical}#website`, ...common}];
  if (item) {
    const extra = item._microfeed ?? {};
    const mediaType = extra.is_audio ? "AudioObject" : extra.is_video ? "VideoObject"
      : extra.is_image ? "ImageObject" : extra.is_document ? "DigitalDocument" : undefined;
    if (!mediaType && !extra.is_external_url) graph.push({
      "@type": "BlogPosting", "@id": `${canonical}#article`, ...common,
      headline: item.title, mainEntityOfPage: {"@id": `${canonical}#webpage`},
      ...(item.date_published ? {datePublished: item.date_published} : {}),
      ...(item.date_modified ? {dateModified: item.date_modified} : {}),
    });
    if (mediaType && item.attachments?.[0]) graph.push({
      "@type": mediaType, "@id": `${canonical}#media`, ...common,
      contentUrl: item.attachments[0].url,
      ...(item.attachments[0].mime_type ? {encodingFormat: item.attachments[0].mime_type} : {}),
      ...(item.date_published ? {datePublished: item.date_published} : {}),
    });
  }
  const json = JSON.stringify({"@context": "https://schema.org", "@graph": graph})
    .replace(/</gu, "\\u003c").replace(/\u2028/gu, "\\u2028").replace(/\u2029/gu, "\\u2029");
  return {language, headHtml: `${cleaned}\n${tags}\n<script type="application/ld+json">${json}</script>`};
}
