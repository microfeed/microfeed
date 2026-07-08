# CLAUDE.md

Guidance for Claude working in this repo. A heavily-customised fork of microfeed — a single-tenant CMS on Cloudflare Pages (D1 + R2) with a React admin and server-rendered public site.

## Golden rules (read first)

- **This is a fork. All work targets `kiran-brahma/microfeed` (`origin`).** Open PRs against the fork's `main`. **Never** push a branch or PR to `upstream` (`microfeed/microfeed`). Never commit directly to `main` — branch first.
- **Do not rename the `_microfeed` JSON key.** It is a stored data-format + public-feed contract (`_buildPublicContentMicrofeedExtra`, `microfeedExtra`). Renaming breaks existing data and external consumers.
- Branding is **configurable, not hardcoded**: `resolveBrand(settings)` in `common-src/BrandUtils.js` reads `webGlobalSettings.brand{Name,Domain,Logo}` and falls back to the neutral `OUR_BRAND` defaults in `common-src/Constants.js` (kept non-"microfeed"). Don't reintroduce hardcoded microfeed strings.

## Layout

- `functions/` — Cloudflare Pages routes (file-based). `functions/admin/**` is the admin UI + ajax; `functions/api/**` is the public API (auth via `x-microfeedapi-key`).
- `edge-src/` — server-side: `models/` (repos + services), `registry/` (content-type field defs), `web/` (public SSR components), `Edge*App/` (admin page shells).
- `client-src/` — React admin apps (`ClientAdmin*App/`) + shared `components/` + `common/`.
- `common-src/` — code shared by edge + client (Constants, StringUtils, TimeUtils, R2Utils, MediaFileUtils, BrandUtils).
- `ops/` — deploy + DB scripts. `ops/db/init.sql` is the schema.

## Data model

- D1 tables: `channels`, `items`, `settings`, `tags`, `item_tags`, `item_relations`, `media`.
- `items.data` and `channels.data` are **JSON TEXT blobs**; images/enclosures are URLs inside them (plus inside rich-text HTML). There is no per-field column.
- Items have `content_type` + `slug` (unique per type). Slugs are user-definable in the editor; on update the existing slug is preserved unless explicitly changed (don't re-slug from the title).

## Content-type registry — the key/source contract

`edge-src/registry/ContentTypeRegistry.js` declares field defs; `itemMapper.js` + the serializer are data-driven from them. **Critical, non-obvious rule:**

- Payloads and "public items" are keyed by **`fieldDef.feedMapping.source`**, NOT `fieldDef.key`. `mapItem`/`validateItem`/`rowToPublicItem`/`serializeItemForFeed` all read/write via `source` (which may be a **nested array path**, e.g. `["_microfeed","itunes:title"]`).
- The admin form must match this: `FormRenderer` and `SchemaItemEditor.seedPayload` read/write by `source` (via `client-src/common/objectPath.js` getByPath/setByPath). If you key a form value by `fieldDef.key` when `key !== source` (e.g. `show_in_nav`→`showInNav`, `seo_*`→`seoTitle`, `itunes:*`), **the value is silently dropped on save and mis-loaded on edit.**

## R2 / media

- R2 is accessed via the **S3 API with `aws4fetch`**, NOT a Workers R2 binding (only D1 is bound in `wrangler.toml`).
- Object keys are prefixed `${CLOUDFLARE_PROJECT_NAME}/${DEPLOYMENT_ENVIRONMENT}/…` (`projectPrefix` in `R2Utils.js`). The internally-stored media URL is host-stripped but **already includes that prefix** — the R2 object key equals the internal URL. Do NOT prepend the prefix again.
- `edge-src/models/MediaStore.js` does S3 list/delete; `MediaService.js` owns the media inventory (dedup by sha-256, usage scan by substring-matching URLs across items/channels/settings JSON, guarded delete, reconcile). Uploads register into the `media` table; the Media Explorer (`client-src/components/MediaExplorer`) browses all files.

## Testing

- `yarn test` (= `TZ=UTC jest`). Write tests first where practical.
- Model/schema tests use `test-utils/d1-substitute.js` (`createMigratedInMemoryDatabase`) — a better-sqlite3-backed D1 double that runs `ops/db/init.sql`.
- **Gotcha:** if DB tests fail with `NODE_MODULE_VERSION` / native-addon errors, rebuild the addon for the running Node: `npm rebuild better-sqlite3` (repo targets Node 22 via volta; installs under a different Node break the ABI).
- React component tests need `/** @jest-environment jsdom */` + `@testing-library/react`.

## Build / deploy

- Client bundles via webpack (`build:production`); each admin page has an entry in `webpack.config.js` (e.g. `media_js`). Edge runs via `wrangler pages dev`.
- Deploy runs `ops/init_feed_db.js` → creates the DB (no-op if it exists), runs **tolerant column migrations** (`ops/db/migrations.js`), then applies `ops/db/init.sql`.
- **`init.sql` is `CREATE TABLE IF NOT EXISTS` — it does NOT add columns to an existing table.** To add a column to a live table, add an `ALTER TABLE … ADD COLUMN` to `ops/db/migrations.js` (run before `init.sql`; expected `duplicate column` / `no such table` errors are tolerated). Otherwise a new index on the column fails on production and the whole batch rolls back.

## Environment gotcha

- This checkout is often a **git worktree nested inside the main repo**, so ESLint finds two `eslint-plugin-react` copies and errors ("Plugin ... was conflicted"). This is an environment artifact, not a code problem. To verify a production build compiles, temporarily move the parent `.eslintrc.js` aside, run `npx webpack`, then restore it.
