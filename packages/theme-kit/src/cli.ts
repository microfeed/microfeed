#!/usr/bin/env node

import {cp, mkdir, readFile, readdir, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {XMLValidator} from "fast-xml-parser";
import {parse} from "parse5";

import {
  renderThemeTemplate,
  themeContext,
} from "../../../src/shared/themes/ThemeRenderer";
import {themeContextSchema} from "../../../src/shared/themes/ThemeContract";
import {ThemeValidationError} from "../../../src/shared/themes/ThemeValidation";
import {BUILT_IN_FIXTURES} from "./fixtures";
import {loadThemePackage} from "./package";

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

async function init(args: Arguments): Promise<void> {
  const directory = path.resolve(args.positionals[0] ?? "microfeed-theme");
  await mkdir(directory, {recursive: true});
  const entries = await readdir(directory);
  if (entries.length > 0) throw new Error(`Refusing to scaffold into non-empty directory ${directory}.`);
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  await cp(path.join(packageRoot, "assets", "starter"), directory, {recursive: true});
  output(`Created theme in ${directory}`, false);
}

async function validate(args: Arguments): Promise<void> {
  const source = args.positionals[0] ?? ".";
  const theme = await loadThemePackage(source);
  output({assets: theme.assetFiles.length, ok: true, packageId: theme.manifest.packageId, version: theme.manifest.version}, args.options.json === true);
}

function contexts(fixture: Record<string, unknown>, packageId: string, version: string) {
  const context = themeContext(fixture, {assetBaseUrl: "/assets/", packageId, version});
  return {context, itemContext: {...context, item: (fixture.items as Array<Record<string, unknown>> | undefined)?.[0]}};
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
  const theme = await loadThemePackage(args.positionals[0] ?? ".");
  const tests: Array<{fixture: string; ok: boolean}> = [];
  for (const [name, fixture] of await fixtureEntries(theme.directory)) {
    const {context, itemContext} = contexts(fixture, theme.manifest.packageId, theme.manifest.version);
    const first = {
      feed: renderThemeTemplate(theme.bundle.webFeed, context),
      header: renderThemeTemplate(theme.bundle.webHeader, context),
      item: renderThemeTemplate(theme.bundle.webItem, itemContext),
      rss: renderThemeTemplate(theme.bundle.rssStylesheet, context),
    };
    const second = {
      feed: renderThemeTemplate(theme.bundle.webFeed, context),
      header: renderThemeTemplate(theme.bundle.webHeader, context),
      item: renderThemeTemplate(theme.bundle.webItem, itemContext),
      rss: renderThemeTemplate(theme.bundle.rssStylesheet, context),
    };
    if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error(`${name}: rendering is not deterministic.`);
    for (const [view, content] of [["feed", first.feed], ["item", first.item]] as const) {
      const parseErrors: Array<{code: string}> = [];
      parse(
        `<!doctype html><html><head>${first.header}</head><body>${renderThemeTemplate(theme.bundle.webBodyStart, context)}${content}${renderThemeTemplate(theme.bundle.webBodyEnd, context)}</body></html>`,
        {onParseError: (error) => parseErrors.push(error)},
      );
      if (parseErrors.length > 0) {
        throw new Error(`${name}: rendered ${view} HTML is invalid (${parseErrors.map(({code}) => code).join(", ")}).`);
      }
    }
    const xml = XMLValidator.validate(first.rss);
    if (xml !== true) throw new Error(`${name}: rendered RSS stylesheet is invalid XML: ${xml.err.msg}`);
    tests.push({fixture: name, ok: true});
  }
  output({ok: true, tests}, args.options.json === true);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function preview(args: Arguments): Promise<void> {
  const theme = await loadThemePackage(args.positionals[0] ?? ".");
  let selectedFixture: Record<string, unknown> = BUILT_IN_FIXTURES.minimal!;
  const fixture = optionString(args, "fixture");
  const feedUrl = optionString(args, "feed-url");
  if (feedUrl) {
    const response = await fetch(feedUrl);
    if (!response.ok) throw new Error(`Feed request failed with HTTP ${response.status}.`);
    selectedFixture = await response.json() as Record<string, unknown>;
  } else if (fixture) {
    selectedFixture = BUILT_IN_FIXTURES[fixture] ?? JSON.parse(await readFile(path.resolve(fixture), "utf8"));
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
      response.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>microfeed theme preview</title><style>body{font:14px system-ui;margin:0;background:#eee}header{display:flex;gap:.5rem;padding:.75rem;background:#111;color:#fff;position:sticky;top:0}button{cursor:pointer}iframe{display:block;width:100%;height:calc(100vh - 54px);border:0;margin:auto;background:#fff}</style></head><body><header><button data-view="feed">Feed</button><button data-view="item">Item</button><button data-view="rss">RSS</button><button id="viewport">Mobile</button></header><iframe sandbox="allow-scripts" src="/render?view=feed"></iframe><script>const frame=document.querySelector('iframe');document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>frame.src='/render?view='+button.dataset.view);document.querySelector('#viewport').onclick=event=>{const mobile=frame.style.width!=='390px';frame.style.width=mobile?'390px':'100%';event.target.textContent=mobile?'Desktop':'Mobile'}</script></body></html>`);
      return;
    }
    const view = url.searchParams.get("view") ?? "feed";
    const {context, itemContext} = contexts(selectedFixture, theme.manifest.packageId, theme.manifest.version);
    response.setHeader("cache-control", "no-store");
    response.setHeader("content-security-policy", "sandbox allow-scripts; default-src 'self' https: data: blob:; img-src 'self' https: data: blob:; font-src 'self' https: data:; script-src 'self' https: 'unsafe-inline' 'unsafe-eval'; style-src 'self' https: data: 'unsafe-inline'; connect-src https:");
    response.setHeader("content-type", "text/html; charset=utf-8");
    if (view === "rss") {
      response.end(`<pre>${escapeHtml(renderThemeTemplate(theme.bundle.rssStylesheet, context))}</pre>`);
      return;
    }
    const body = renderThemeTemplate(view === "item" ? theme.bundle.webItem : theme.bundle.webFeed, view === "item" ? itemContext : context);
    response.end(`<!doctype html><html><head>${renderThemeTemplate(theme.bundle.webHeader, context)}</head><body>${renderThemeTemplate(theme.bundle.webBodyStart, context)}${body}${renderThemeTemplate(theme.bundle.webBodyEnd, context)}</body></html>`);
  });
  await new Promise<void>((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  output(`Theme preview: http://127.0.0.1:${port}/`, false);
}

async function pullFixture(args: Arguments): Promise<void> {
  const url = args.positionals[0];
  const filename = optionString(args, "output");
  if (!url || !filename) throw new Error("Usage: microfeed-theme fixture pull <json-feed-url> --output <file>");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Feed request failed with HTTP ${response.status}.`);
  const feed = await response.json() as Record<string, unknown>;
  themeContextSchema.parse(themeContext(feed, {
    assetBaseUrl: "",
    packageId: "fixture",
    version: "0.0.0",
  }));
  await writeFile(path.resolve(filename), `${JSON.stringify(feed, null, 2)}\n`, {flag: "wx"});
  output(`Saved public feed fixture to ${filename}. Review it before committing copied content.`, false);
}

async function main(): Promise<void> {
  const [command = "help", ...rest] = process.argv.slice(2);
  const args = parseArguments(rest);
  if (command === "init") return init(args);
  if (command === "validate") return validate(args);
  if (command === "test") return test(args);
  if (command === "preview") return preview(args);
  if (command === "fixture" && args.positionals.shift() === "pull") return pullFixture(args);
  process.stdout.write("microfeed-theme init|validate|test|preview|fixture pull\n");
}

main().catch((error: unknown) => {
  const diagnostics = error instanceof ThemeValidationError ? error.diagnostics : [error instanceof Error ? error.message : String(error)];
  const json = process.argv.includes("--json");
  process.stderr.write(json ? `${JSON.stringify({diagnostics, ok: false})}\n` : `${diagnostics.join("\n")}\n`);
  process.exitCode = 1;
});
