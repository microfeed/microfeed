import Mustache from "mustache";

import {
  SITE_FILE_MAX_BYTES,
  type SiteFileGenerator,
} from "./SiteFiles";

const DEFAULT_ROBOTS_TEMPLATE = `User-agent: *
Allow: /
Sitemap: {{{_site.sitemap_url}}}
`;

const DEFAULT_LLMS_TEMPLATE = `# {{{title}}}

{{{_microfeed.description_text}}}

- Website: {{{home_page_url}}}
- JSON Feed: {{{_site.json_feed_url}}}
- RSS Feed: {{{_site.rss_feed_url}}}
{{#_site.has_pages}}

## Pages

{{#pages}}
- [{{{title}}}]({{{url}}}){{#meta_description}}: {{{meta_description}}}{{/meta_description}}
{{/pages}}
{{/_site.has_pages}}
{{#_site.has_items}}

## Recent items

{{#items}}
- [{{{title}}}]({{{_site.web_url}}})
{{/items}}
{{/_site.has_items}}
`;

const DEFAULT_SITEMAP_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url>
    <loc>{{home_page_url}}</loc>
{{#icon}}
    <image:image><image:loc>{{icon}}</image:loc></image:image>
{{/icon}}
  </url>
{{#pages}}
  <url>
    <loc>{{url}}</loc>
    <lastmod>{{date_modified}}</lastmod>
  </url>
{{/pages}}
{{#items}}
  <url>
    <loc>{{_site.web_url}}</loc>
{{#date_published}}
    <lastmod>{{date_published}}</lastmod>
{{/date_published}}
{{#_site.images}}
    <image:image><image:loc>{{url}}</image:loc></image:image>
{{/_site.images}}
{{#_site.videos}}
    <video:video>
      <video:title>{{title}}</video:title>
{{#date_published}}
      <video:publication_date>{{date_published}}</video:publication_date>
{{/date_published}}
      <video:content_loc>{{url}}</video:content_loc>
    </video:video>
{{/_site.videos}}
  </url>
{{/items}}
</urlset>
`;

const DEFAULT_SITE_FILE_TEMPLATES: Record<SiteFileGenerator, string> = {
  llms: DEFAULT_LLMS_TEMPLATE,
  robots: DEFAULT_ROBOTS_TEMPLATE,
  sitemap: DEFAULT_SITEMAP_TEMPLATE,
};

export function defaultSiteFileTemplate(
  generator: SiteFileGenerator | undefined,
): string | undefined {
  return generator ? DEFAULT_SITE_FILE_TEMPLATES[generator] : undefined;
}

export function validateSiteFileTemplateSource(
  template: string,
): string | undefined {
  if (template.includes("\0")) return "NUL bytes are not allowed.";
  if (new TextEncoder().encode(template).byteLength > SITE_FILE_MAX_BYTES) {
    return `Template must be ${SITE_FILE_MAX_BYTES} bytes or smaller.`;
  }
  try {
    Mustache.parse(template);
  } catch (error) {
    return `Invalid Mustache template: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
  return undefined;
}

export function renderSiteFileTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  return Mustache.render(template, context);
}
