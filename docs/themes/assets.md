---
title: Bundle CSS, JavaScript, and assets
description: Choose inline or R2-backed theme output and build reproducible browser bundles with Vite, Webpack, Tailwind, or another local tool.
---

microfeed never runs a theme repository's install or build scripts during
theme installation. Build browser assets locally, commit the rendered package
files, validate them, and install the immutable result.

## Choose inline or packaged output

| Output | Installed storage | R2 required? | Referenced from |
| --- | --- | --- | --- |
| CSS inside `<style>` and JavaScript inside `<script>` | Theme text in D1 | No | `web-header.mustache` and `web-body-end.mustache` |
| Generated `.css` and `.js` declared under `assets` | Immutable objects in R2 | Yes | `{{_theme.asset_base_url}}` |
| TypeScript, source CSS, bundler configuration, and `node_modules` | Source repository only | No | Never loaded by the installed theme |

Inline output is convenient for small self-contained themes and remains
editable in an Admin draft. It counts toward the per-slot and total text
limits. Declared assets suit larger cacheable bundles, but Admin drafts inherit
them unchanged; rebuild and install a new repository version to replace one.

Do not declare source files, build configuration, `node_modules`, or source
maps as runtime assets.

## Build inline output

A local build script can capture bundler output and place it directly into the
rendered Mustache files. With Vite, use `write: false`, locate the CSS asset and
JavaScript entry chunk, then wrap them in `<style>` and `<script>`:

```js
const result = await build({
  build: {
    lib: {entry: "src/main.ts", formats: ["iife"], name: "MyTheme"},
    minify: true,
    write: false,
  },
});

// Read the CSS asset and JavaScript entry chunk from result.output.
// Write <style>…</style> into web-header.mustache and
// <script>…</script> into web-body-end.mustache.
```

Keep `assets: []` in `microfeed-theme.json`. Escape any generated closing
`</script>` sequence before embedding JavaScript. The bundled source under
`themes/default` is the complete reference: it uses Tailwind CSS v4 through
`@tailwindcss/vite`, Vite's programmatic output, and vanilla TypeScript while
remaining usable without R2.

## Emit packaged assets with Vite

Import CSS from the JavaScript entry and emit deterministic filenames:

```ts
// vite.config.ts
import {resolve} from "node:path";
import {defineConfig} from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, "src/main.ts"),
      formats: ["iife"],
      name: "MyMicrofeedTheme",
      fileName: () => "theme.js",
      cssFileName: "theme",
    },
    minify: true,
    outDir: "assets",
  },
});
```

To compile Tailwind v4 in the same build, install `tailwindcss` and
`@tailwindcss/vite`, import the plugin, and add it to Vite's `plugins` array.

## Emit packaged assets with Webpack

Webpack can create the same deterministic files:

```js
// webpack.config.cjs
const path = require("node:path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  mode: "production",
  entry: "./src/main.ts",
  output: {
    clean: true,
    filename: "theme.js",
    path: path.resolve(__dirname, "assets"),
  },
  module: {rules: [
    {test: /\.ts$/, exclude: /node_modules/, use: "ts-loader"},
    {test: /\.css$/, use: [MiniCssExtractPlugin.loader, "css-loader"]},
  ]},
  plugins: [new MiniCssExtractPlugin({filename: "theme.css"})],
  resolve: {extensions: [".ts", ".js"]},
};
```

Use any local bundler that produces deterministic browser files; microfeed
validates the finished package rather than prescribing the toolchain.

## Declare and load packaged files

Declare every generated runtime file:

```json
{
  "assets": ["assets/theme.css", "assets/theme.js"]
}
```

Load them without repeating the `assets/` directory:

```html
<!-- web-header.mustache -->
<link rel="stylesheet" href="{{_theme.asset_base_url}}theme.css">

<!-- web-body-end.mustache -->
<script src="{{_theme.asset_base_url}}theme.js" defer></script>
```

The local preview maps `_theme.asset_base_url` to its `/assets/` handler. On
installation, `yarn manage theme` validates declared files, uploads them to
immutable R2 keys, verifies the uploads, and stores their paths, checksums,
sizes, and content types with the installed theme. The live asset base URL uses
microfeed's public media route; the Worker never contacts GitHub or runs the
bundler while rendering a page.

Enable R2 before installing a theme with declared assets:

```console
yarn manage deploy --enable-r2 --instance <instance-name>
```

Use `--local` for a local-only site's simulated media store. External HTTPS
bundles can be linked directly and are not stored by microfeed, but packaged or
inline output keeps versions and previews reproducible.

After each build, run `yarn validate`, `yarn test`, and `yarn preview`. Then
increment the package version and follow [Build and release a theme](/themes/)
for inactive installation and activation.
