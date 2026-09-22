import type {AdminHelpContent} from "./AdminHelpLabel";

// These examples describe the public feed and generated metadata, not editor state.
const jsonLd = (type: string, properties: Record<string, unknown>) =>
  `<script type="application/ld+json">\n${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [{"@type": type, ...properties}],
  }, null, 2)}\n</script>`;

export function getSeoHelpContent(isItem: boolean) {
  const scope = isItem ? "Item" : "Channel";
  const json = (fields: Record<string, unknown>) => JSON.stringify(isItem ? {items: [fields]} : fields, null, 2);
  const help = (linkName: string, content: Omit<AdminHelpContent, "linkName" | "modalTitle">): AdminHelpContent => ({
    linkName,
    modalTitle: `${scope} / ${linkName}`,
    jsonNote: isItem
      ? "JSON Feed excerpt: these fields belong to an entry in items. The item API uses the same fields on the item object."
      : "JSON Feed excerpt: these fields belong to the feed root. The channel API uses the same fields on the channel object.",
    ...content,
  });
  const publisherHelp = (linkName: string, text: string, publisher: Record<string, unknown>) => help(linkName, {
    text,
    html: jsonLd("WebSite", {publisher: {name: "Example publisher", ...Object.fromEntries(
      Object.entries(publisher).map(([key, value]) => [key === "type" ? "@type" : key === "same_as" ? "sameAs" : key, value]),
    )}}),
    htmlNote: "Excerpt from the generated JSON-LD graph. Publisher details also appear on item pages. The name comes from Publisher above.",
    json: json({_microfeed: {publisher: {name: "Example publisher", ...publisher}}}),
  });
  const socialImage = {
    url: "https://example.com/social.jpg", width: 1200, height: 630, mime_type: "image/jpeg",
  };
  const author = {name: "Alex Smith", type: "Person", url: "https://example.com/alex/"};

  return {
    title: help("SEO title", {
      text: "The title suggested to search engines and social networks, also used in the browser tab. " +
        `Leave it blank to use the ${scope.toLowerCase()}'s title. This does not rename the ${scope.toLowerCase()} or change its RSS title.`,
      html: '<title>A title for search and sharing</title>\n' +
        '<meta property="og:title" content="A title for search and sharing">\n' +
        '<meta name="twitter:title" content="A title for search and sharing">',
      htmlNote: "An explicit SEO title replaces these theme tags. Without an override, existing custom theme metadata takes precedence over the fallback.",
      json: json({_microfeed: {seo: {title: "A title for search and sharing"}}}),
    }),
    description: help("SEO description", {
      text: "A short summary suggested to search engines and social networks. Leave it blank to use a plain-text summary " +
        `of the ${scope.toLowerCase()}'s description. It does not change the full description or RSS feed.`,
      html: '<meta name="description" content="A short summary of this content.">\n' +
        '<meta property="og:description" content="A short summary of this content.">\n' +
        '<meta name="twitter:description" content="A short summary of this content.">',
      htmlNote: "An explicit SEO description replaces these theme tags. Search engines and social networks may choose a different excerpt.",
      json: json({_microfeed: {seo: {description: "A short summary of this content."}}}),
    }),
    slug: help("Item URL", {
      text: "The address of this item's page on your site. Enter the part after <code>/i/</code> and choose Apply URL to save it. " +
        "Previous page addresses redirect to the new one; later title edits keep the saved address.<br><br>" +
        "When Link is blank, this address is also the canonical URL suggested to search engines. " +
        "A valid Link set above takes precedence for the canonical URL and <code>og:url</code>.",
      html: '<link rel="canonical" href="https://example.com/i/my-story/">\n' +
        '<meta property="og:url" content="https://example.com/i/my-story/">',
      htmlNote: "Example with Link left blank. The canonical URL also supplies url in the generated JSON-LD graph.",
      json: json({url: "https://example.com/i/my-story/", _microfeed: {slug: "my-story", web_url: "https://example.com/i/my-story/"}}),
      jsonNote: "JSON Feed item excerpt. Set _microfeed.slug through the item API to change the local address. _microfeed.web_url is a generated, read-only field; url corresponds to Link.",
    }),
    language: help("Item language", {
      text: "The language of this item, using a language tag such as <code>en</code> or <code>en-US</code>. " +
        "Choose Inherit from channel to use the channel's language. This describes the content; it does not translate it.",
      html: '<html lang="en-US">\n\n' + jsonLd("WebPage", {inLanguage: "en-US"}),
      htmlNote: "Excerpts from the page's root element and JSON-LD graph. Other generated item graph entries use the same language.",
      json: json({language: "en-US"}),
      jsonNote: "JSON Feed item excerpt. language is a top-level item field. With inheritance, the item field is omitted and the feed's language supplies the default.",
    }),
    image: help("Social image", {
      text: "The image suggested when a link is shared. Upload a JPEG or PNG and crop it to 1200 × 630. " +
        (isItem ? "The fallback order is: this item's social image, this item's cover image, the channel's social image, then the channel image."
          : "Removing the social image restores the channel image as the fallback.") +
        " This does not replace cover art in the RSS feed.",
      html: '<meta property="og:image" content="https://example.com/social.jpg">\n' +
        '<meta property="og:image:width" content="1200">\n' +
        '<meta property="og:image:height" content="630">\n' +
        '<meta property="og:image:type" content="image/jpeg">\n' +
        '<meta name="twitter:card" content="summary_large_image">\n' +
        '<meta name="twitter:image" content="https://example.com/social.jpg">',
      htmlNote: "The effective image URL also supplies image in the generated JSON-LD graph. Existing custom theme image tags may apply when no explicit social image is set.",
      json: json({_microfeed: {seo: {social_image: socialImage}}}),
    }),
    alt: help("Social image alt text", {
      text: "A brief description of the custom social image for people who cannot see it. " +
        "Describe the image's useful content. This text belongs to the social image; it does not change the main description.",
      html: '<meta property="og:image:alt" content="A mountain reflected in a lake">\n' +
        '<meta name="twitter:image:alt" content="A mountain reflected in a lake">',
      htmlNote: "These tags are generated when the effective social image has nonempty alt text.",
      json: json({_microfeed: {seo: {social_image: {...socialImage, alt: "A mountain reflected in a lake"}}}}),
    }),
    "publisher-type": publisherHelp("Publisher type",
      "Identifies the publisher as a Person or Organization in structured data. Unspecified leaves the type out. " +
      "This does not change the publisher's name or podcast attribution.", {type: "Organization"}),
    "publisher-url": publisherHelp("Publisher profile URL",
      "An official page about the publisher, such as an About page or personal profile. " +
      "It identifies the publisher in structured data; it does not change the channel's website or canonical URL.",
      {url: "https://example.com/about/"}),
    profiles: publisherHelp("Official profile links",
      "Other official pages for the same publisher, such as verified social profiles. Enter one full HTTP or HTTPS URL per line. " +
      "They become <code>sameAs</code> links in structured data, helping search engines connect these profiles to the publisher.",
      {same_as: ["https://social.example.com/publisher"]}),
    authors: help(isItem ? "Item authors" : "Default authors", {
      text: (isItem
        ? "People or organizations credited for this item. A nonempty list replaces the channel's default authors. Remove all item authors to inherit the defaults."
        : "People or organizations credited by default on items. An item's own authors replace this list when configured.") +
        " Each author has a name, an optional Person or Organization type, and an optional profile URL. " +
        "These authors do not change the podcast publisher or <code>itunes:author</code>.",
      html: jsonLd("WebPage", {author: [{"@type": author.type, name: author.name, url: author.url}]}),
      htmlNote: "Excerpt from an item page's JSON-LD graph. The effective authors also appear on other generated item graph entries. The generated channel graph does not include authors.",
      json: json({authors: [{name: author.name, url: author.url}], _microfeed: {authors: [author]}}),
      jsonNote: "JSON Feed exposes name and url in authors. The _microfeed.authors extension also stores type. " +
        (isItem ? "Inherited authors appear in the item's authors; _microfeed.authors is present only for item-specific authors."
          : "Set _microfeed.authors through the channel API to manage default authors separately from the podcast publisher."),
    }),
  };
}

export type SeoHelpField = keyof ReturnType<typeof getSeoHelpContent>;
