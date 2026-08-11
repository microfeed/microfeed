import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import tailwindcss from "@tailwindcss/vite";
import {build} from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checking = process.argv.includes("--check");
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
`;
const tokenBlock = `<style id="microfeed-design-tokens">
${designTokenCss}</style>`;

const sourceDirectory = path.join(root, "src/templates");
const rssTemplate = await readFile(path.join(sourceDirectory, "rss-stylesheet.xsl"), "utf8");
const rssStylesMarker = "/* microfeed:compiled-tailwind */";
if (!rssTemplate.includes(rssStylesMarker)) {
  throw new Error("The RSS stylesheet is missing its compiled Tailwind marker.");
}
const rssStyles = `${designTokenCss}\n${css.source}`
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;");
const files = new Map([
  ["web-feed.mustache", await readFile(path.join(sourceDirectory, "web-feed.mustache"), "utf8")],
  ["web-item.mustache", await readFile(path.join(sourceDirectory, "web-item.mustache"), "utf8")],
  ["web-body-start.mustache", await readFile(path.join(sourceDirectory, "web-body-start.mustache"), "utf8")],
  ["rss-stylesheet.xsl", rssTemplate.replace(rssStylesMarker, rssStyles)],
  ["web-header.mustache", `${tokenBlock}\n<style id="microfeed-compiled-styles">${css.source}</style>\n${await readFile(path.join(sourceDirectory, "web-header.mustache"), "utf8")}`],
  ["web-body-end.mustache", `${await readFile(path.join(sourceDirectory, "web-body-end.mustache"), "utf8")}\n<script>${javascript.code.replaceAll("</script", "<\\/script")}</script>\n`],
]);

const stale = [];
for (const [filename, contents] of files) {
  const output = path.join(root, filename);
  if (checking) {
    if (await readFile(output, "utf8").catch(() => "") !== contents) stale.push(filename);
  } else {
    await writeFile(output, contents);
  }
}
if (stale.length > 0) {
  throw new Error(`Generated default-theme files are stale: ${stale.join(", ")}. Run yarn workspace @microfeed/default-theme-source build.`);
}
