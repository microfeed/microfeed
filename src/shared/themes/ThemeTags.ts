import {escapeHtml} from "../Html";
import type {TagRecord} from "../Tags";
import {THEME_OPTIONAL_FILE_KEYS, THEME_OPTIONAL_FILE_PATHS, type ThemeBundleV1, type ThemeContext, type ThemeManifestV1, type ThemeTagDirectory} from "./ThemeContract";

// The platform fallback is also used by previews and optional Admin templates.
export const DEFAULT_WEB_TAGS_TEMPLATE = `<main class="mf-tags-directory">
  {{#tags}}
  <h1>{{title}}</h1>
  <ul>
    {{#items}}
    <li>
      <h2><a rel="tag" href="{{url}}">{{name}}</a></h2>
      <p>{{description}}</p>
      <p>{{published_item_count}} published items{{#rss_enabled}} · <a href="{{rss_url}}">RSS</a>{{/rss_enabled}}{{#json_enabled}} · <a href="{{json_url}}">JSON Feed</a>{{/json_enabled}}</p>
    </li>
    {{/items}}
  </ul>
  {{^items}}<p>No tags yet.</p>{{/items}}
  {{#next_url}}<nav aria-label="Tag pagination"><a href="{{next_url}}">Next tags</a></nav>{{/next_url}}
  {{/tags}}
</main>`;

export function tagTemplate(bundle: Pick<ThemeBundleV1, "webTag" | "webFeed">): string {
  return bundle.webTag ?? bundle.webFeed;
}

export function tagsTemplate(bundle: Pick<ThemeBundleV1, "webTags">): string {
  return bundle.webTags ?? DEFAULT_WEB_TAGS_TEMPLATE;
}

export function manifestWithTagTemplates(
  manifest: ThemeManifestV1,
  bundle: ThemeBundleV1,
  savedManifest: ThemeManifestV1 = manifest,
): ThemeManifestV1 {
  const updated = {...manifest};
  updated.files = {...manifest.files};
  for (const key of THEME_OPTIONAL_FILE_KEYS) {
    if (bundle[key] === undefined) delete updated.files[key];
    else updated.files[key] ??= savedManifest.files[key] ?? THEME_OPTIONAL_FILE_PATHS[key];
  }
  return updated;
}

export function tagDirectoryContext(
  items: Array<Pick<TagRecord, "id" | "name" | "slug" | "description" | "published_item_count" | "url" | "rss_url" | "json_url">>,
  url: string,
  options: {nextUrl?: string; rssEnabled?: boolean; jsonEnabled?: boolean} = {},
): ThemeTagDirectory {
  return {
    items: items.map(item => ({...item})), title: "Tags", url,
    ...(options.nextUrl ? {next_url: options.nextUrl} : {}),
    rss_enabled: options.rssEnabled ?? true,
    json_enabled: options.jsonEnabled ?? true,
  };
}

/** Representative tag views, without querying or changing a site's tags. */
export function tagPreviewContexts(context: ThemeContext) {
  let origin = "https://example.test";
  try {
    origin = new URL(context._microfeed?.base_url || context.home_page_url || origin).origin;
  } catch { /* Partial preview fixtures may omit an absolute site URL. */ }
  const tag = context._microfeed?.tag ?? {
    id: "preview-tag", name: "Featured", slug: "featured",
    description: "Published items about this topic.", published_item_count: context.items.length,
    url: `${origin}/tags/featured/`, rss_url: `${origin}/tags/featured/rss/`, json_url: `${origin}/tags/featured/json/`,
  };
  const extra = context._microfeed;
  const paginationUrl = (value: unknown): string | undefined => {
    if (typeof value !== "string" || !value) return undefined;
    try {
      const url = new URL(tag.url);
      url.search = new URL(value, origin).search;
      return url.href;
    } catch { return undefined; }
  };
  const methods = Array.isArray(extra?.subscribe_methods) ? extra.subscribe_methods : [];
  const enabled = (format: string) => !methods.some(method => method.type === format && method.editable === false && method.enabled === false);
  const tagContext: ThemeContext = {
    ...context, title: tag.name, description: escapeHtml(tag.description),
    home_page_url: tag.url, feed_url: tag.json_url, tags_active: true,
    _microfeed: {
      base_url: origin, categories: [], microfeed_version: "", ...extra,
      tag, description_text: tag.description,
      subscribe_methods: methods.map(method => ({...method,
        ...(method.type === "rss" ? {url: tag.rss_url} : method.type === "json" ? {url: tag.json_url} : {}),
      })),
      next_url: paginationUrl(extra?.next_url ?? context.next_url),
      prev_url: paginationUrl(extra?.prev_url),
    },
  };
  const tagsContext: ThemeContext = {
    ...context, items: [], tags_active: true,
    ...(extra ? {_microfeed: {...extra, tag: undefined}} : {}),
    tags: context.tags ?? tagDirectoryContext([tag], `${origin}/tags/`, {
      rssEnabled: enabled("rss"), jsonEnabled: enabled("json"),
    }),
  };
  return {tagContext, tagsContext};
}
