import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import tailwindcss from "@tailwindcss/vite";
import {build} from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checking = process.argv.includes("--check");
const normalizeNewlines = (value) => value.replaceAll(/\r\n?/gu, "\n");
const readText = async (filename) => normalizeNewlines(
  await readFile(filename, "utf8"),
);
const generated = await build({
  build: {
    cssCodeSplit: false,
    emptyOutDir: false,
    lib: {
      entry: path.join(root, "src/main.ts"),
      formats: ["iife"],
      name: "MicrofeedDefaultTheme",
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
const css = outputs.find((entry) => entry.type === "asset" && entry.fileName.endsWith(".css"));
const javascript = outputs.find((entry) => entry.type === "chunk" && entry.isEntry);
if (!css || typeof css.source !== "string" || !javascript || javascript.type !== "chunk") {
  throw new Error("Vite did not return the expected inline CSS and JavaScript bundles.");
}

const designTokenCss = `/* microfeed design tokens
 * For a quick color change in Admin, edit only the values in this block.
 */
:root {
  --mf-accent: #0997cc;
  --mf-background: #ffffff;
  --mf-surface: #f6f8fa;
  --mf-text: #24292f;
  --mf-muted: #57606a;
  --mf-border: #dcdcdc;
}

.dark {
  --mf-accent: #58c7f3;
  --mf-background: #0d1117;
  --mf-surface: #161b22;
  --mf-text: #f0f3f6;
  --mf-muted: #9da7b3;
  --mf-border: #30363d;
}
`;
const tokenBlock = `<style id="microfeed-design-tokens">
${designTokenCss}</style>`;

const sourceDirectory = path.join(root, "src/templates");
const rssTemplate = await readText(path.join(sourceDirectory, "rss-stylesheet.xsl"));
const rssStylesMarker = "/* microfeed:compiled-tailwind */";
if (!rssTemplate.includes(rssStylesMarker)) {
  throw new Error("The RSS stylesheet is missing its compiled Tailwind marker.");
}
const rssStyles = `${designTokenCss}\n${css.source}`
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;");
const files = new Map([
  ["web-feed.mustache", await readText(path.join(sourceDirectory, "web-feed.mustache"))],
  ["web-item.mustache", await readText(path.join(sourceDirectory, "web-item.mustache"))],
  ["web-page.mustache", await readText(path.join(sourceDirectory, "web-page.mustache"))],
  ["web-search.mustache", await readText(path.join(sourceDirectory, "web-search.mustache"))],
  ["web-body-start.mustache", await readText(path.join(sourceDirectory, "web-body-start.mustache"))],
  ["rss-stylesheet.xsl", rssTemplate.replace(rssStylesMarker, rssStyles)],
  ["web-header.mustache", `${tokenBlock}\n<style id="microfeed-compiled-styles">${css.source}</style>\n${await readText(path.join(sourceDirectory, "web-header.mustache"))}`],
  ["web-body-end.mustache", `${await readText(path.join(sourceDirectory, "web-body-end.mustache"))}\n<script>${javascript.code.replaceAll("</script", "<\\/script")}</script>\n`],
]);

const stale = [];
for (const [filename, contents] of files) {
  const output = path.join(root, filename);
  if (checking) {
    if (normalizeNewlines(await readFile(output, "utf8").catch(() => "")) !== contents) stale.push(filename);
  } else {
    await writeFile(output, contents);
  }
}
if (stale.length > 0) {
  throw new Error(`Generated default-theme files are stale: ${stale.join(", ")}. Run yarn workspace @microfeed/default-theme-source build.`);
}
