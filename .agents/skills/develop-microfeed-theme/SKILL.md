---
name: develop-microfeed-theme
description: Develop, revise, build, validate, test, and preview a microfeed theme repository. Use when editing microfeed-theme.json, any of the six theme files, theme build sources, fixtures, schemas, packaged assets, or immutable theme versions.
---

# Develop a microfeed theme

1. Read `THEME.md`, `microfeed-theme.json`, and the schemas under `.microfeed/schemas/` completely before editing.
2. Inspect package scripts and source directories. Run `yarn install` before the baseline checks when the repository has a Yarn package. Do not rely on dependencies from a parent workspace.
3. If the repository has build sources, edit those sources and regenerate the six declared output files; do not hand-edit generated bundles. Keep all files inside the package directory and modify only declared templates, declared assets, build sources, fixtures, and documentation.
4. Run the package build when present, then prefer the repository scripts `yarn validate` and `yarn test`. Fall back to `theme-kit validate . --json` and `theme-kit test . --json` only when those scripts are absent. Repair every diagnostic.
5. Prefer `yarn preview` for visual review, falling back to `theme-kit preview .` only when needed. Use supplied fixtures first; use a public JSON feed only when real content is needed. Stop the preview server after verification.
6. Increment the manifest SemVer before installing changed content. Never reuse a published package ID and version for different content.
7. Install as inactive. Do not activate a theme or change a live site without explicit permission.

## Bundle CSS and JavaScript

- The installer never runs Vite, Webpack, Tailwind, or package scripts. Keep TypeScript, source CSS, bundler configuration, and `node_modules` in the repository; build and commit every generated runtime file before validation or installation.
- For a small bundle that must work without R2, capture Vite or Webpack output and embed CSS in `<style>` inside `web-header.mustache` and JavaScript in `<script>` inside `web-body-end.mustache`. Keep `assets: []`. These generated slots are stored in the immutable D1 theme row, count toward the theme text limits, and can be edited in an Admin-derived draft. Escape any `</script>` sequence when generating inline JavaScript.
- For larger or independently cacheable output, configure Vite with deterministic library-mode filenames, or Webpack with a deterministic `output.filename` and `MiniCssExtractPlugin`. Emit files such as `assets/theme.css` and `assets/theme.js`, declare every file in the manifest, and reference them as `{{_theme.asset_base_url}}theme.css` and `{{_theme.asset_base_url}}theme.js` without repeating `assets/`.
- Declared asset bytes are uploaded to immutable R2 keys during installation; D1 stores their metadata and owning theme version. They require R2 on the target instance and cannot be replaced from a V1 Admin draft. The standalone preview serves the same references from its local asset handler. Never hard-code `/assets/`, `/media/`, an R2 hostname, or an environment name.
- After changing build sources, run the package build and its deterministic/staleness check when present. Confirm generated bundles are declared, exclude source maps and other unsupported development artifacts, validate and test the rendered package, then bump SemVer.

Keep packaged assets declared in the manifest. Themes with assets need R2 enabled on the target instance; text-only and inline-bundle themes do not. Never create screenshots unless the user explicitly asks for them.
