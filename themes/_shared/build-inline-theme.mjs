import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import tailwindcss from "@tailwindcss/vite";
import {build} from "vite";

const TEMPLATE_FILENAMES = [
  "web-feed.mustache",
  "web-item.mustache",
  "web-page.mustache",
  "web-search.mustache",
  "web-header.mustache",
  "web-body-start.mustache",
  "web-body-end.mustache",
  "rss-stylesheet.xsl",
];
const normalizeNewlines = (value) => value.replaceAll(/\r\n?/gu, "\n");

export function themeRoot(importMetaUrl) {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "..");
}

export async function buildInlineTheme({
  bundleName,
  checking,
  designTokenCss,
  label,
  root,
}) {
  const generated = await build({
    build: {
      cssCodeSplit: false,
      emptyOutDir: false,
      lib: {
        entry: path.join(root, "src/main.ts"),
        formats: ["iife"],
        name: bundleName,
      },
      minify: true,
      write: false,
    },
    configFile: false,
    plugins: [tailwindcss()],
    root,
  });
  const outputs = (Array.isArray(generated) ? generated : [generated])
    .flatMap((entry) => entry.output);
  const css = outputs.find((entry) =>
    entry.type === "asset" && entry.fileName.endsWith(".css")
  );
  const javascript = outputs.find((entry) =>
    entry.type === "chunk" && entry.isEntry
  );
  if (
    !css || typeof css.source !== "string" || !javascript ||
    javascript.type !== "chunk"
  ) {
    throw new Error(
      `Vite did not return the expected inline bundles for ${label}.`,
    );
  }

  const sourceDirectory = path.join(root, "src/templates");
  const sources = new Map(await Promise.all(TEMPLATE_FILENAMES.map(
    async (filename) => [
      filename,
      normalizeNewlines(
        await readFile(path.join(sourceDirectory, filename), "utf8"),
      ),
    ],
  )));
  const rssMarker = "/* microfeed:compiled-theme */";
  const rssTemplate = sources.get("rss-stylesheet.xsl");
  if (!rssTemplate?.includes(rssMarker)) {
    throw new Error(`${label} is missing its compiled RSS style marker.`);
  }

  const tokenBlock = `<style id="microfeed-design-tokens">\n${designTokenCss}</style>`;
  const compiledCss = `${designTokenCss}\n${css.source}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;");
  const files = new Map([
    ["web-feed.mustache", sources.get("web-feed.mustache")],
    ["web-item.mustache", sources.get("web-item.mustache")],
    ["web-page.mustache", sources.get("web-page.mustache")],
    ["web-search.mustache", sources.get("web-search.mustache")],
    ["web-body-start.mustache", sources.get("web-body-start.mustache")],
    [
      "rss-stylesheet.xsl",
      rssTemplate.replace(rssMarker, compiledCss),
    ],
    [
      "web-header.mustache",
      `${tokenBlock}\n<style id="microfeed-compiled-styles">${css.source}</style>\n${sources.get("web-header.mustache")}`,
    ],
    [
      "web-body-end.mustache",
      `${sources.get("web-body-end.mustache")}\n<script>${javascript.code.replaceAll("</script", "<\\/script")}</script>\n`,
    ],
  ]);

  const stale = [];
  for (const [filename, contents] of files) {
    const output = path.join(root, filename);
    if (checking) {
      if (
        normalizeNewlines(await readFile(output, "utf8").catch(() => "")) !==
          contents
      ) {
        stale.push(filename);
      }
    } else {
      await writeFile(output, contents);
    }
  }
  if (stale.length > 0) {
    throw new Error(
      `Generated ${label} files are stale: ${stale.join(", ")}. Run its build script.`,
    );
  }
}
