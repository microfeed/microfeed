# CMS Upgrade Summary (2026-02-05)

This document captures the work completed to expand the CMS from a podcast-only model into a more general CMS with types, categories, SEO, and hard delete. It is intended as a handoff note for future sessions.

## High-Level Goals
- Add true hard delete (replace old soft-delete behavior).
- Add item `Type` and `Category` fields (backed by new tables, not hard-coded).
- Add SEO fields + JSON-LD support.
- Add iTunes Series selection via a new table.
- Add new feeds for audio/video.
- Keep existing items as `podcast` type.

## Database Changes
### New Tables
- `item_types` (Podcast, Video, Blog Post, Static Page)
- `categories` (hierarchical via `parent_id`)
- `site_seo` (global site SEO defaults + logo/OG image)
- `itunes_series` (name, slug, description, image)

### New Columns on `items`
- `type_id`
- `primary_category_id`
- `secondary_category_id` (optional)
- `itunes_series_id`
- `slug`
- `seo_title`
- `seo_description`
- `canonical_url`
- `noindex`
- `og_image`

### Migration Files
- **Init:** `ops/db/init.sql` (full schema, used for fresh DB)
- **Migration:** `ops/db/migrations/2026-02-05_cms.sql` (ALTER + create tables + seed types + seed site_seo + backfill items -> podcast)

### Notes
- For **existing** production DBs, run the migration file.
- For **fresh local DB**, run **init.sql only** (do not run migration after init).

## API Changes
### New Endpoints
- `GET/POST/PUT/DELETE /api/item_types`
- `GET/POST/PUT/DELETE /api/categories`
- `GET/PUT /api/site_seo`
- `GET/POST/PUT/DELETE /api/itunes_series`

### Item Updates
`/api/items/:id` DELETE now supports:
- default: archive (status=ARCHIVED)
- `?hard=true` => hard delete + removes R2 media (if stored in bucket)

### JSON/RSS Feeds
- `GET /rss/?type=audio` => podcast type only
- `GET /rss/?type=video` => video type only
- `GET /json/audio`
- `GET /json/video`

## Admin UI Changes
### Settings
Added new panels:
- Site SEO
- Item Types
- Categories (hierarchical)
- iTunes Series (description + image)

### Edit Item
Added fields:
- Type
- Primary/Secondary Category
- SEO (title/description/canonical/noindex/og image)
- Slug (auto-generated, editable)
- iTunes Series picker (for podcast type)

### Hard Delete
Added hard delete option in admin (uses `/admin/ajax/items/:id?hard=true`).

## Public Rendering Changes
### SEO + JSON-LD
`HtmlHeader` now supports:
- OpenGraph, Twitter meta
- canonical
- robots (noindex)
- JSON-LD (BlogPosting, PodcastEpisode, VideoObject, WebPage, WebSite)

### Feed JSON
`_microfeed` extended with:
- `site_seo`
- `item_types`
- `categories_flat`
- `itunes_series`
Each item includes:
- `_microfeed.type`
- `_microfeed.categories`
- `_microfeed.seo`
- `_microfeed['itunes:series']`

### RSS
RSS includes `<itunes:series>` when selected.

## Code Touchpoints (Key Files)
- DB schema: `ops/db/init.sql`, `ops/db/migrations/2026-02-05_cms.sql`
- Admin settings UI: `client-src/ClientAdminSettingsApp/components/SettingsApp.jsx`
- Admin edit item UI: `client-src/ClientAdminItemsApp/components/EditItemApp/index.jsx`
- API: `edge-src/EdgeApiApp` (new endpoints, request/response fields)
- Feed JSON builder: `edge-src/models/FeedPublicJsonBuilder.js`
- RSS builder: `edge-src/models/FeedPublicRssBuilder.js`
- HTML meta: `edge-src/components/HtmlHeader`
- Delete handling: `edge-src/EdgeApiApp`, `edge-src/EdgeCommonRequests`

## OpenAPI Docs
- YAML source: `edge-src/EdgeApiApp/openapi.yaml.html`
- Served at: `/json/openapi.yaml`
- HTML viewer: `/json/openapi.html`
- Added redirect: `/json/openapi` -> `/json/openapi.html` via `functions/json/openapi/index.jsx`

## Deployment Notes
### GitHub Action (Cloudflare Pages)
The workflow only runs `init.sql` during deploy. For existing DBs, you must run:
```
wrangler d1 execute FEED_DB --remote -e production --file ops/db/migrations/2026-02-05_cms.sql
```

### Common Cause of “Deployed but Different”
If the custom domain is attached to **production** only, but you deployed **preview**, you’ll see old UI on the custom domain. Ensure the deploy command used:
```
wrangler pages deploy ... --branch main
```

## Local Dev Notes
- `yarn dev` runs `setup:development` and `wrangler pages dev`.
- For local DB, run **init.sql only** (no migration) after clearing state.
- The onboarding checklist disables sidebar until `R2 public bucket url` is set in Settings.

## Outstanding TODOs / Checks
- Confirm production DB migration applied.
- Confirm custom domain points to the correct Pages project and production branch.
- Verify `/json/openapi` returns HTML after deploying.
