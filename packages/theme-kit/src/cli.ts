#!/usr/bin/env node

import {realpathSync} from "node:fs";
import {cp, mkdir, readFile, readdir, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {SyntaxValidator} from "fast-xml-validator";
import {parse} from "parse5";

import packageMetadata from "../package.json";
import {
  publicSearchHtml,
  type PublicSearchResult,
} from "../../../src/shared/PublicSearch";
import {
  renderThemeTemplate,
  themeContext,
} from "../../../src/shared/themes/ThemeRenderer";
import {
  themeContextSchema,
  type ThemeManifestV1,
} from "../../../src/shared/themes/ThemeContract";
import {themeRssPreviewDocument} from "../../../src/shared/themes/RssPreview";
import {
  manifestSearchItemDestination,
  resolveThemeSearchItemUrl,
} from "../../../src/shared/themes/ThemeSearch";
import {ThemeValidationError} from "../../../src/shared/themes/ThemeValidation";
import {BUILT_IN_FIXTURES} from "./fixtures";
import {renderThemeKitHelp} from "./help";
import {
  loadThemePackage,
  type LoadedThemePackage,
} from "./package";

interface Arguments {options: Record<string, string | boolean>; positionals: string[]}

function parseArguments(values: string[]): Arguments {
  const options: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!value.startsWith("--")) { positionals.push(value); continue; }
    const [name, inline] = value.slice(2).split("=", 2);
    if (!name) throw new Error(`Invalid option: ${value}`);
    const next = values[index + 1];
    if (inline !== undefined) options[name] = inline;
    else if (next && !next.startsWith("--")) {options[name] = next; index += 1;}
    else options[name] = true;
  }
  return {options, positionals};
}

function optionString(args: Arguments, name: string): string | undefined {
  return typeof args.options[name] === "string" ? args.options[name] : undefined;
}

function output(value: unknown, json: boolean): void {
  process.stdout.write(json ? `${JSON.stringify(value)}\n` : `${String(value)}\n`);
}

function resolveInvocationPath(value: string): string {
  return path.resolve(process.cwd(), value);
}

async function init(args: Arguments): Promise<void> {
  const directory = resolveInvocationPath(
    args.positionals[0] ?? "microfeed-theme",
  );
  await mkdir(directory, {recursive: true});
  const entries = await readdir(directory);
  if (entries.length > 0) throw new Error(`Refusing to scaffold into non-empty directory ${directory}.`);
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  await cp(path.join(packageRoot, "assets", "starter"), directory, {recursive: true});
  await writeFile(path.join(directory, "yarn.lock"), "");
  output(`Created theme in ${directory}`, false);
}

async function validate(args: Arguments): Promise<void> {
  const source = resolveInvocationPath(args.positionals[0] ?? ".");
  const theme = await loadThemePackage(source);
  output({assets: theme.assetFiles.length, ok: true, packageId: theme.manifest.packageId, version: theme.manifest.version}, args.options.json === true);
}

function contexts(
  fixture: Record<string, unknown>,
  manifest: ThemeManifestV1,
) {
  const context = themeContext(fixture, {
    assetBaseUrl: "/assets/",
    packageId: manifest.packageId,
    version: manifest.version,
  });
  const items = context.items;
  const previewPublishedAt = items
    .map((item) => stringValue(item.date_published))
    .find((value): value is string => value !== undefined) ??
    new Date().toISOString();
  const page = context.page ?? {
    content_html: "<p>Standalone Page content.</p>",
    content_text: "Standalone Page content.",
    date_created: previewPublishedAt,
    date_modified: previewPublishedAt,
    date_published: previewPublishedAt,
    id: "page-about",
    is_not_found_page: false,
    meta_description: "Learn more about this site.",
    navigation_label: "About",
    navigation_order: 10,
    show_in_navigation: true,
    slug: "about",
    status: "published",
    title: "About",
    url: "https://example.test/about/",
  };
  const navigation_pages = context.navigation_pages?.length
    ? context.navigation_pages
    : [
      page,
      {
        id: "page-contact",
        navigation_label: "Contact",
        navigation_order: 20,
        slug: "contact",
        title: "Contact",
        url: "https://example.test/contact/",
      },
      {
        id: "page-projects",
        navigation_label: "Projects",
        navigation_order: 30,
        slug: "projects",
        title: "Projects",
        url: "https://example.test/projects/",
      },
    ];
  const baseUrl = absoluteUrl(
    recordValue(fixture._microfeed)?.base_url ?? fixture.home_page_url,
    "https://example.test/",
  ) ?? "https://example.test/";
  const searchItemDestination = manifestSearchItemDestination(manifest);
  const suppliedSearchResults: PublicSearchResult[] =
    (context.search?.results ?? [])
    .map((result) => ({
      content_text: result.content_text,
      date_published: result.date_published,
      highlights: result.highlights,
      id: result.id,
      title: result.title,
      type: result.type,
      url: result.url,
    }));
  const previewResults: PublicSearchResult[] = suppliedSearchResults.length > 0
    ? suppliedSearchResults
    : items.slice(0, 5).map((item, index) => {
      const id = stringValue(item.id) ?? `preview-item-${index + 1}`;
      const microfeed = recordValue(item._microfeed);
      const attachment = Array.isArray(item.attachments)
        ? recordValue(item.attachments[0])
        : undefined;
      const webUrl = absoluteUrl(microfeed?.web_url, baseUrl) ??
        new URL(`/i/${encodeURIComponent(id)}/`, baseUrl).toString();
      return {
        content_text: stringValue(item.content_text) ?? "Published item preview",
        date_published: stringValue(item.date_published) ?? previewPublishedAt,
        id,
        title: stringValue(item.title) ?? `Preview item ${index + 1}`,
        type: "item" as const,
        url: resolveThemeSearchItemUrl(searchItemDestination, {
          attachmentUrl: absoluteUrl(attachment?.url, baseUrl),
          itemUrl: absoluteUrl(item.url, baseUrl),
          webUrl,
        }),
      };
    });
  if (previewResults.length === 0) {
    previewResults.push({
      content_text: "This representative item shows how a search result is styled.",
      date_published: previewPublishedAt,
      id: "preview-item",
      title: "Preview item",
      type: "item",
      url: new URL("/i/preview-item/", baseUrl).toString(),
    });
  }
  if (suppliedSearchResults.length === 0) {
    for (const navigationPage of navigation_pages) {
      previewResults.push({
        content_text: navigationPage.id === page.id
          ? page.content_text
          : `Representative content for the ${navigationPage.title} Page.`,
        date_published: previewPublishedAt,
        id: navigationPage.id,
        title: navigationPage.title,
        type: "page",
        url: navigationPage.url,
      });
    }
  }
  return {
    context: {...context, navigation_pages},
    itemContext: {...context, navigation_pages, item: items[0]},
    pageContext: {...context, navigation_pages, page},
    previewResults,
    searchContext: {
      ...context,
      navigation_pages,
      search: {query: context.search?.query ?? "hello", results: previewResults},
    },
  };
}

export function standaloneThemePreviewDocument(
  theme: LoadedThemePackage,
  fixture: Record<string, unknown>,
  view: string,
): string {
  const {
    context,
    itemContext,
    pageContext,
    previewResults,
    searchContext,
  } = contexts(fixture, theme.manifest);
  const templates = {
    feed: [theme.bundle.webFeed, context],
    item: [theme.bundle.webItem, itemContext],
    page: [theme.bundle.webPage ?? theme.bundle.webFeed, pageContext],
    search: [theme.bundle.webSearch ?? theme.bundle.webFeed, searchContext],
  } as const;
  const selected = templates[view as keyof typeof templates] ?? templates.feed;
  const body = renderThemeTemplate(selected[0], selected[1]);
  const publicSearch = theme.manifest.formatVersion === 2
    ? publicSearchHtml({previewResults})
    : "";
  return `<!doctype html><html><head>${renderThemeTemplate(theme.bundle.webHeader, context)}</head><body>${renderThemeTemplate(theme.bundle.webBodyStart, context)}${body}${renderThemeTemplate(theme.bundle.webBodyEnd, context)}${publicSearch}</body></html>`;
}

async function fixtureEntries(directory: string): Promise<Array<[string, Record<string, unknown>]>> {
  const entries = Object.entries(BUILT_IN_FIXTURES);
  const fixtureDirectory = path.join(directory, "fixtures");
  const files = await readdir(fixtureDirectory).catch(() => []);
  for (const filename of files.filter((value) => value.endsWith(".json")).sort()) {
    entries.push([`package:${filename}`, JSON.parse(await readFile(path.join(fixtureDirectory, filename), "utf8"))]);
  }
  return entries;
}

async function test(args: Arguments): Promise<void> {
  const theme = await loadThemePackage(
    resolveInvocationPath(args.positionals[0] ?? "."),
  );
  const tests: Array<{fixture: string; ok: boolean}> = [];
  for (const [name, fixture] of await fixtureEntries(theme.directory)) {
    const {context, itemContext, pageContext, searchContext} = contexts(
      fixture,
      theme.manifest,
    );
    const first = {
      feed: renderThemeTemplate(theme.bundle.webFeed, context),
      header: renderThemeTemplate(theme.bundle.webHeader, context),
      item: renderThemeTemplate(theme.bundle.webItem, itemContext),
      ...(theme.bundle.webPage ? {page: renderThemeTemplate(theme.bundle.webPage, pageContext)} : {}),
      ...(theme.bundle.webSearch ? {search: renderThemeTemplate(theme.bundle.webSearch, searchContext)} : {}),
      rss: renderThemeTemplate(theme.bundle.rssStylesheet, context),
    };
    const second = {
      feed: renderThemeTemplate(theme.bundle.webFeed, context),
      header: renderThemeTemplate(theme.bundle.webHeader, context),
      item: renderThemeTemplate(theme.bundle.webItem, itemContext),
      ...(theme.bundle.webPage ? {page: renderThemeTemplate(theme.bundle.webPage, pageContext)} : {}),
      ...(theme.bundle.webSearch ? {search: renderThemeTemplate(theme.bundle.webSearch, searchContext)} : {}),
      rss: renderThemeTemplate(theme.bundle.rssStylesheet, context),
    };
    if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error(`${name}: rendering is not deterministic.`);
    for (const [view, content] of Object.entries(first).filter(([view]) => view !== "header" && view !== "rss")) {
      const parseErrors: Array<{code: string}> = [];
      parse(
        `<!doctype html><html><head>${first.header}</head><body>${renderThemeTemplate(theme.bundle.webBodyStart, context)}${content}${renderThemeTemplate(theme.bundle.webBodyEnd, context)}</body></html>`,
        {onParseError: (error) => parseErrors.push(error)},
      );
      if (parseErrors.length > 0) {
        throw new Error(`${name}: rendered ${view} HTML is invalid (${parseErrors.map(({code}) => code).join(", ")}).`);
      }
    }
    try {
      SyntaxValidator.validate(first.rss);
    } catch (error) {
      throw new Error(
        `${name}: rendered RSS stylesheet is invalid XML: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    tests.push({fixture: name, ok: true});
  }
  output({ok: true, tests}, args.options.json === true);
}

function escapeXml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function absoluteUrl(value: unknown, baseUrl: string | undefined): string | undefined {
  const source = stringValue(value);
  if (!source) return undefined;
  try {
    return new URL(source, baseUrl).toString();
  } catch {
    return source;
  }
}

function rssDate(entry: Record<string, unknown>, microfeed: Record<string, unknown>): string | undefined {
  const published = stringValue(entry.date_published);
  const milliseconds = typeof microfeed.date_published_ms === "number"
    ? microfeed.date_published_ms
    : published ? Date.parse(published) : Number.NaN;
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toUTCString() : published;
}

function rssDuration(attachment: Record<string, unknown>, microfeed: Record<string, unknown>): string | undefined {
  const formatted = stringValue(microfeed.duration_hhmmss);
  if (formatted) return formatted;
  if (typeof attachment.duration_in_seconds !== "number" || attachment.duration_in_seconds < 0) return undefined;
  const seconds = Math.floor(attachment.duration_in_seconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":");
}

function element(name: string, value: unknown): string {
  return value === undefined || value === null || value === ""
    ? ""
    : `<${name}>${escapeXml(value)}</${name}>`;
}

function rssLink(rel: string, href: string | undefined): string {
  return href
    ? `<atom:link rel="${rel}" href="${escapeXml(href)}" type="application/rss+xml"/>`
    : "";
}

function rssCategories(microfeed: Record<string, unknown>): string {
  if (!Array.isArray(microfeed.categories)) return "";
  return microfeed.categories.map((value) => {
    const category = recordValue(value);
    const name = stringValue(category?.name);
    if (!name) return "";
    const nested = Array.isArray(category?.categories)
      ? recordValue(category.categories[0])
      : undefined;
    const nestedName = stringValue(nested?.name);
    return `<itunes:category text="${escapeXml(name)}">${nestedName ? `<itunes:category text="${escapeXml(nestedName)}"/>` : ""}</itunes:category>`;
  }).join("");
}

function rssItem(value: unknown, baseUrl: string | undefined): string {
  const entry = recordValue(value) ?? {};
  const microfeed = recordValue(entry._microfeed) ?? {};
  const attachment = Array.isArray(entry.attachments)
    ? recordValue(entry.attachments[0])
    : undefined;
  const itemUrl = absoluteUrl(entry.url, baseUrl) ?? absoluteUrl(microfeed.web_url, baseUrl);
  const enclosureUrl = absoluteUrl(attachment?.url, baseUrl);
  const enclosureType = stringValue(attachment?.mime_type);
  const enclosureLength = typeof attachment?.size_in_bytes === "number"
    ? attachment.size_in_bytes
    : typeof attachment?.size_in_byte === "number" ? attachment.size_in_byte : undefined;
  const enclosure = enclosureUrl
    ? `<enclosure url="${escapeXml(enclosureUrl)}"${enclosureType ? ` type="${escapeXml(enclosureType)}"` : ""}${enclosureLength !== undefined ? ` length="${escapeXml(enclosureLength)}"` : ""}/>`
    : "";
  const authors = Array.isArray(entry.authors) ? entry.authors : [];
  const author = stringValue(recordValue(authors[0])?.name);
  const image = absoluteUrl(entry.image, baseUrl) ?? absoluteUrl(entry.banner_image, baseUrl);
  return `<item>${element("title", stringValue(entry.title) ?? "untitled")}${element("link", itemUrl)}${element("description", stringValue(entry.content_html) ?? stringValue(entry.content_text))}${element("guid", stringValue(entry.id))}${element("pubDate", rssDate(entry, microfeed))}${author ? element("itunes:author", author) : ""}${image ? `<itunes:image href="${escapeXml(image)}"/>` : ""}${enclosure}${attachment ? element("itunes:duration", rssDuration(attachment, microfeed)) : ""}</item>`;
}

export function jsonFeedFixtureToRss(fixture: Record<string, unknown>): string {
  const microfeed = recordValue(fixture._microfeed) ?? {};
  const homePageUrl = absoluteUrl(fixture.home_page_url, stringValue(microfeed.base_url));
  const baseUrl = stringValue(microfeed.base_url) ?? homePageUrl;
  const icon = absoluteUrl(fixture.icon, baseUrl) ?? absoluteUrl(fixture.favicon, baseUrl);
  const authors = Array.isArray(fixture.authors) ? fixture.authors : [];
  const author = stringValue(recordValue(authors[0])?.name);
  const subscribeMethods = Array.isArray(microfeed.subscribe_methods) ? microfeed.subscribe_methods : [];
  const rssMethod = subscribeMethods.map(recordValue).find((method) =>
    method && (stringValue(method.type)?.toLowerCase() === "rss" || stringValue(method.name)?.toLowerCase() === "rss")
  );
  const rssUrl = absoluteUrl(rssMethod?.url, baseUrl);
  const nextUrl = absoluteUrl(microfeed.next_url ?? fixture.next_url, baseUrl);
  const prevUrl = absoluteUrl(microfeed.prev_url, baseUrl);
  const title = stringValue(fixture.title) ?? "untitled";
  const items = Array.isArray(fixture.items) ? fixture.items : [];
  const image = icon
    ? `<itunes:image href="${escapeXml(icon)}"/><image>${element("title", title)}${element("url", icon)}${element("link", homePageUrl)}</image>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>${element("title", title)}${element("description", fixture.description)}${element("link", homePageUrl)}${element("language", fixture.language)}${rssLink("self", rssUrl)}${rssLink("prev", prevUrl)}${rssLink("next", nextUrl)}${author ? element("itunes:author", author) : ""}${image}${element("copyright", microfeed.copyright)}${rssCategories(microfeed)}${items.map((item) => rssItem(item, baseUrl)).join("")}</channel></rss>`;
}

async function preview(args: Arguments): Promise<void> {
  const theme = await loadThemePackage(
    resolveInvocationPath(args.positionals[0] ?? "."),
  );
  let selectedFixture: Record<string, unknown> = theme.previewFixture ??
    BUILT_IN_FIXTURES.minimal!;
  const fixture = optionString(args, "fixture");
  const feedUrl = optionString(args, "feed-url");
  if (feedUrl) {
    const response = await fetch(feedUrl);
    if (!response.ok) throw new Error(`Feed request failed with HTTP ${response.status}.`);
    selectedFixture = await response.json() as Record<string, unknown>;
  } else if (fixture) {
    selectedFixture = BUILT_IN_FIXTURES[fixture] ?? JSON.parse(
      await readFile(resolveInvocationPath(fixture), "utf8"),
    );
  }
  themeContextSchema.parse(themeContext(selectedFixture, {
    assetBaseUrl: "/assets/",
    packageId: theme.manifest.packageId,
    version: theme.manifest.version,
  }));
  const previewAssets = new Map(theme.assetFiles.map((asset) => [
    asset.path.replace(/^assets\//u, ""),
    asset,
  ]));
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname.startsWith("/assets/")) {
      let requestedPath = "";
      try {
        requestedPath = decodeURIComponent(url.pathname.slice("/assets/".length));
      } catch {
        response.statusCode = 400;
        response.end("Invalid asset path.");
        return;
      }
      const asset = previewAssets.get(requestedPath);
      if (!asset) {
        response.statusCode = 404;
        response.end("Theme asset not found.");
        return;
      }
      response.setHeader("cache-control", "no-store");
      response.setHeader("content-type", asset.contentType);
      response.setHeader("x-content-type-options", "nosniff");
      response.end(asset.bytes);
      return;
    }
    if (url.pathname === "/") {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>microfeed theme preview</title><style>body{font:14px system-ui;margin:0;background:#eee}header{display:flex;gap:.5rem;padding:.75rem;background:#111;color:#fff;position:sticky;top:0}button{cursor:pointer}iframe{display:block;width:100%;height:calc(100vh - 54px);border:0;margin:auto;background:#fff}</style></head><body><header><button data-view="feed">Feed</button><button data-view="item">Item</button>${theme.bundle.webPage ? '<button data-view="page">Page</button><button data-view="search">Search</button>' : ''}<button data-view="rss">RSS</button><button id="viewport">Mobile</button></header><iframe sandbox="allow-scripts" src="/render?view=feed"></iframe><script>const frame=document.querySelector('iframe');document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>frame.src='/render?view='+button.dataset.view);document.querySelector('#viewport').onclick=event=>{const mobile=frame.style.width!=='390px';frame.style.width=mobile?'390px':'100%';event.target.textContent=mobile?'Desktop':'Mobile'}</script></body></html>`);
      return;
    }
    const view = url.searchParams.get("view") ?? "feed";
    const {context} = contexts(selectedFixture, theme.manifest);
    response.setHeader("cache-control", "no-store");
    response.setHeader("content-security-policy", "sandbox allow-scripts; default-src 'self' https: data: blob:; img-src 'self' https: data: blob:; font-src 'self' https: data:; script-src 'self' https: 'unsafe-inline' 'unsafe-eval'; style-src 'self' https: data: 'unsafe-inline'; connect-src https:");
    response.setHeader("content-type", "text/html; charset=utf-8");
    if (view === "rss") {
      response.end(themeRssPreviewDocument(
        jsonFeedFixtureToRss(selectedFixture),
        renderThemeTemplate(theme.bundle.rssStylesheet, context),
      ));
      return;
    }
    response.end(standaloneThemePreviewDocument(theme, selectedFixture, view));
  });
  await new Promise<void>((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  output(`Theme preview: http://127.0.0.1:${port}/`, false);
}

async function pullFixture(args: Arguments): Promise<void> {
  const url = args.positionals[0];
  const filename = optionString(args, "output");
  if (!url || !filename) throw new Error("Usage: theme-kit fixture pull <json-feed-url> --output <file>");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Feed request failed with HTTP ${response.status}.`);
  const feed = await response.json() as Record<string, unknown>;
  themeContextSchema.parse(themeContext(feed, {
    assetBaseUrl: "",
    packageId: "fixture",
    version: "0.0.0",
  }));
  await writeFile(
    resolveInvocationPath(filename),
    `${JSON.stringify(feed, null, 2)}\n`,
    {flag: "wx"},
  );
  output(`Saved public feed fixture to ${filename}. Review it before committing copied content.`, false);
}

async function main(): Promise<void> {
  const values = process.argv.slice(2);
  const [command = "help", ...rest] = values;
  if (command === "-v" || command === "--version") {
    output(packageMetadata.version, false);
    return;
  }
  if (command === "help" || command === "-h" || command === "--help") {
    output(renderThemeKitHelp(command === "help" ? rest.join(" ") || undefined : undefined), false);
    return;
  }
  if (rest.includes("-h") || rest.includes("--help")) {
    const topic = command === "fixture" && rest[0] === "pull"
      ? "fixture pull"
      : command;
    output(renderThemeKitHelp(topic), false);
    return;
  }
  const args = parseArguments(rest);
  if (command === "init") return init(args);
  if (command === "validate") return validate(args);
  if (command === "test") return test(args);
  if (command === "preview") return preview(args);
  if (command === "fixture" && args.positionals.shift() === "pull") return pullFixture(args);
  throw new Error(`Unknown command: ${command}\n\n${renderThemeKitHelp()}`);
}

function isDirectInvocation(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) ===
      realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  }
}

if (isDirectInvocation()) {
  main().catch((error: unknown) => {
    const diagnostics = error instanceof ThemeValidationError ? error.diagnostics : [error instanceof Error ? error.message : String(error)];
    const json = process.argv.includes("--json");
    process.stderr.write(json ? `${JSON.stringify({diagnostics, ok: false})}\n` : `${diagnostics.join("\n")}\n`);
    process.exitCode = 1;
  });
}
