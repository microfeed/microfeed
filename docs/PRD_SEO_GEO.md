# PRD — SEO & GEO (structured data, meta, crawler files)

**Branch:** `feat/seo-geo` (checked out). Do NOT commit to `main`.
**Obey** `docs/AGENT_PROMPTS.md` shared rules: tests-first (write failing tests, confirm RED, implement to GREEN), `yarn test` all green before stopping, parameterized SQL, minimal scope, `corepack yarn@4.9.2` for installs.

## 0. Goal
Add complete, standards-based SEO + GEO (generative-engine / AI-search) support to the public site: Open Graph + Twitter Card meta, JSON-LD structured data on every public page, per-item SEO overrides, site-level SEO settings (publisher identity, key terms, default share image, social links), and crawler files (robots.txt, sitemap fix, auto-generated llms.txt, feed/sitemap discovery links).

## 1. Audit (current state)
- Public pages render via `edge-src/web/RecordPageLayout.jsx` → only `<title>`, `meta description`, `canonical`, `viewport`, `lang`, and a `no-referrer` meta. **No OG, Twitter, or JSON-LD anywhere in the repo.**
- `functions/sitemap.xml.jsx` + `SitemapResponseBuilder` (in `edge-src/common/PageUtils.js`) build from the **old** feed shape (`item._microfeed.web_url`) — may not match the new `/blog/ /i/ /photo/ /gallery/` URL scheme; no listing pages.
- No `robots.txt`, no `llms.txt`.
- Settings are JSON blobs: table `settings(category VARCHAR(20) PRIMARY KEY, data TEXT)`. **No `init.sql` migration needed** — new SEO settings = a new category; per-item SEO = registry field defs (data-driven, stored in item `data` JSON).
- `webGlobalSettings` only holds favicon/publicBucketUrl/itemsPerPage/itemsSortOrder.
- Item public fields available (via `serializeItemForFeed`): title, author, date_published_ms, content_html, excerpt, caption, image, tags, attachment, taken_date, url, guid, slug, content_type.
- Admin settings pattern: each app is a card in `client-src/ClientAdminSettingsApp/components/SettingsApp.jsx`, reads `feed.settings[category]`, saves via `onSubmit(e, category, bundle)` → POST `ADMIN_URLS.ajaxFeed()` `{settings:{[category]:bundle}}`. Mirror `WebGlobalSettingsApp`.

## 2. Settled decisions
- **Per-item SEO overrides:** add optional `seo_title`, `seo_description`, `share_image`, `noindex` to each content type (registry, data-driven → auto-render in admin editor). Fall back to derived values.
- **Publisher/author:** configurable in settings — `publisherType` (`Organization`|`Person`), `publisherName`, `publisherLogo`, `sameAs` (social URLs). JSON-LD publisher/author built from it.
- **Key terms:** a settings field emitted as schema.org `keywords` on WebSite + `meta[name=keywords]`; per-item `tags` also feed keywords.
- **GEO extras (all):** `robots.txt`, fixed+extended sitemap, **auto-generated `llms.txt`** (built from every published page's meta description), feed+sitemap discovery links in `<head>`.
- **llms.txt is rendered automatically** from the same per-page meta descriptions the SEO layer computes — do not hand-maintain it.

## 3. Data / settings layer (Phase 1)

### 3.1 SEO settings category
- Add `SETTINGS_CATEGORIES.SEO = 'seoSettings'` in `common-src/Constants.js` (≤20 chars ✓).
- Shape (all optional, stored under `settings.seoSettings`):
  - `siteName` (string; default → channel.title)
  - `defaultShareImage` (image path; OG fallback; image-kind so it needs publicBucketUrl join at render)
  - `keyTerms` (string, comma-separated)
  - `publisherType` (`'Organization'|'Person'`; default `'Organization'`)
  - `publisherName` (string; default → channel.title)
  - `publisherLogo` (image path)
  - `sameAs` (array of URLs)
  - `twitterHandle` (string, e.g. `@handle`)

### 3.2 Per-item SEO registry fields
- In `edge-src/registry/ContentTypeRegistry.js`, append a shared SEO field set to **each** type (podcast_episode, blog_article, photo, gallery, landing_page):
  - `makeFieldDef("seo_title", "text", {target: "seoTitle", source: "seoTitle"})`
  - `makeFieldDef("seo_description", "text", {target: "seoDescription", source: "seoDescription"})`
  - `makeFieldDef("share_image", "image", {target: "shareImage", source: "shareImage"})`
  - `makeFieldDef("noindex", "boolean", {target: "noindex", source: "noindex"})`
- Use a small local helper (e.g. `seoFieldDefs()`) so the set is declared once, spread into each type. These auto-render in the admin editor (FormRenderer) and flow through the serializer (share_image gets publicBucketUrl-joined by the image-kind path).

### 3.3 Admin UI — SeoSettingsApp
- New `client-src/ClientAdminSettingsApp/components/SeoSettingsApp/index.jsx` mirroring `WebGlobalSettingsApp` (class component, `SettingsBase`, `AdminInput`, `AdminImageUploaderApp` for images, `AdminRadio` for publisherType, a repeatable URL list for `sameAs`). Reads `feed.settings.seoSettings`, saves category `seoSettings`.
- Register it as a card in `SettingsApp.jsx` grid.
- Add explain texts to `FormExplainTexts.js` if that pattern is used by siblings.

## 4. Rendering layer (Phase 2)

### 4.1 SEO builders (pure)
`edge-src/web/seo/buildSeo.js` — pure functions returning a `PageSeo` object `{title, description, canonicalUrl, ogType, image, siteName, twitterHandle, keywords, noindex, publishedTime, modifiedTime, author, section, tags, jsonLd}` where `jsonLd` is a JS object (or array) to be JSON-stringified.
- `siteSeo({channel, seoSettings, canonicalUrl})` → WebSite + publisher (Organization|Person with `sameAs`, `logo`) node(s). Home page.
- `recordSeo({item, contentType, channel, seoSettings, publicBucketUrl, canonicalUrl})` → per type:
  - blog_article → `BlogPosting` (headline, description, image, datePublished, dateModified?, author, publisher, keywords, mainEntityOfPage) + `BreadcrumbList`.
  - podcast_episode → `PodcastEpisode` (name, description, datePublished, associatedMedia `AudioObject` contentUrl from attachment, partOfSeries `PodcastSeries` = site, author/publisher) + `BreadcrumbList`.
  - photo → `Photograph`/`ImageObject` (contentUrl=image, caption, datePublished from taken_date/date_published, author) + `BreadcrumbList`.
- `aggregatorSeo(...)`:
  - gallery → `ImageGallery` (name, description, image, `associatedMedia`/`hasPart` = member ImageObjects) + `BreadcrumbList`.
  - landing_page → `CollectionPage` (name, description, `hasPart` = matched items) + `BreadcrumbList`.
- `listingSeo({typeLabel, items, canonicalUrl, ...})` → `CollectionPage` with an `ItemList` of the listed items.
- Fallback/derive rules: title = `seo_title || item.title/caption || siteName`; description = `seo_description || excerpt || caption || meta-stripped content_html || channel.description`; image = `share_image || item.image || seoSettings.defaultShareImage || channel.image` (absolute via publicBucketUrl — reuse `serializeChannelForWeb`/serializer join semantics); noindex = `item.noindex === true || status === UNLISTED`; keywords = `[...item.tags, ...keyTerms]`.

### 4.2 Head components
- `edge-src/web/seo/MetaTags.jsx` — from a `PageSeo`, render: `og:title/description/image/url/type/site_name`, `twitter:card=summary_large_image`, `twitter:site`, `twitter:creator`, `twitter:title/description/image`, `article:published_time/modified_time/author/section` + `article:tag` (for blog/podcast), `meta[name=keywords]`, `meta[name=robots]` (`noindex,nofollow` when noindex else omit or `index,follow`).
- `edge-src/web/seo/JsonLd.jsx` — render `<script type="application/ld+json">` with `JSON.stringify(seo.jsonLd)` (guard against XSS: no user HTML in JSON-LD strings; values are plain text — but still escape `</` → `<\/` to be safe inside the script tag).
- `RecordPageLayout` gains a single optional `seo` prop; when present it renders `<MetaTags>` + feed/sitemap discovery `<link rel="alternate">` (RSS `application/rss+xml`, JSON `application/feed+json`) + `<link rel="sitemap">` in `<head>`, and `<JsonLd>` at end of `<body>`. Keep existing title/description/canonical (or source them from `seo` when provided — avoid duplicate tags: if `seo` present, render title/description/canonical from it and skip the old ad-hoc ones).

### 4.3 Wire into pages/handlers
- `functions/index.jsx` (home) → build `siteSeo`, pass to `HomePage`→layout.
- record/aggregator/type-listing resolvers already return `{item, members, channel, content, publicBucketUrl, navTypes}`; also compute + return `seo` (needs `seoSettings` from `content.settings.seoSettings`). Pass `seo` through each page component into `RecordPageLayout`.
- Each page component (`BlogArticlePage`, `PhotoPage`, `PodcastEpisodePage`, `GalleryPage`, `LandingPage`, `HomePage`, `TypeListingPage`) accepts `seo` and forwards to the layout.

## 5. Crawler routes (Phase 3)
- `functions/robots.txt.jsx` → `text/plain`: `User-agent: *` / `Allow: /` / `Disallow: /admin` / `Disallow: /api` / blank / `Sitemap: <origin>/sitemap.xml`. (Origin from request URL.)
- Fix `functions/sitemap.xml.jsx`: emit correct URLs for the new scheme. Simplest robust approach — rewrite the route to build from `ItemRepo` + `itemPublicUrl`: include `/`, the listing roots that have content (`/blog/ /photo/ /i/ /gallery/`), every PUBLISHED record + gallery + landing item (absolute URL via origin + `itemPublicUrl`), with `<lastmod>` from pub_date and `<image:image>` when the item has an image. Exclude `noindex`/UNLISTED. Keep valid sitemap XML. (If reusing `SitemapResponseBuilder` is cleaner, ensure it uses the new URLs.)
- `functions/llms.txt.jsx` → `text/plain`, **auto-generated**: a header (`# <siteName>` + site description + site URL), then sections per content type listing each PUBLISHED, indexable item as `- [title](absolute_url): meta_description` using the SAME description logic as the SEO layer (import from `buildSeo`). Include listing/section links. This is the machine-readable site summary for AI crawlers — no manual content.

## 6. Tests (tests-first — RED → GREEN)
React tests: `/** @jest-environment jsdom */` + `@testing-library/react`. Mirror existing `edge-src/web/*.test.js`, `edge-src/registry/ContentTypeRegistry.test.js`, `edge-src/web/TypeListingRoutes.test.js`.
1. `buildSeo` unit tests — per type: correct `@type`, required JSON-LD props, fallback chain (seo_title→title→siteName; description fallback; image fallback; noindex from field or UNLISTED; keywords merge). Publisher Person vs Organization + sameAs. Absolute image URLs.
2. `MetaTags` / `JsonLd` render tests — OG/Twitter/robots tags present with right content; JSON-LD script parses as valid JSON and has expected `@type`; `</` escaped.
3. Registry test — each type now has the 4 SEO fields with correct kinds/targets; existing fields unchanged.
4. Serializer test — `share_image` gets publicBucketUrl-joined; `seo_description`/`noindex`/`seo_title` round-trip.
5. Integration (route) tests — blog detail HTML contains a `BlogPosting` JSON-LD block + `og:title`; podcast → `PodcastEpisode`; gallery → `ImageGallery`; home → `WebSite` + publisher; a `noindex` item emits `robots noindex`; UNLISTED item is noindex.
6. Route tests — `robots.txt` (200 text/plain, has Sitemap line, Disallow /admin); `sitemap.xml` (contains new-scheme URLs for published items, excludes noindex); `llms.txt` (lists a published blog item with its meta description; excludes noindex).
7. SeoSettingsApp — renders fields from `feed.settings.seoSettings` and calls onSubmit with category `seoSettings` (jsdom). A registry/settings-shape assertion is acceptable if full form testing is heavy.

Run `yarn test` — everything green (existing 288 + new).

## 7. Out of scope
- No `init.sql` column migrations (settings/registry are JSON/data-driven).
- No changes to record/aggregator page *body* markup beyond adding the SEO head/JSON-LD.
- No hreflang/i18n, no AMP, no third-party SEO services.
- No analytics changes.

## 8. Acceptance
- Every public page emits valid JSON-LD of the correct `@type`, plus OG + Twitter tags, canonical, and robots (noindex where applicable).
- Site-level publisher identity, key terms, default share image, and social `sameAs` are editable in admin and reflected in JSON-LD/meta.
- Each item can override SEO title/description/share image and set noindex from the admin editor (auto via registry).
- `/robots.txt`, `/sitemap.xml` (new URLs), and auto-generated `/llms.txt` all serve correctly; feed+sitemap discovery links appear in `<head>`.
- No duplicated head tags; `yarn test` fully green; scope limited to SEO files + registry SEO fields + settings + tests.

## 9. Suggested build order (phase-gated; a phase must be green before the next)
1. Phase 1 — Constants + registry SEO fields + serializer + SeoSettingsApp + tests.
2. Phase 2 — buildSeo + MetaTags + JsonLd + RecordPageLayout `seo` prop + wire resolvers/handlers/pages + tests.
3. Phase 3 — robots.txt + sitemap fix + llms.txt + head discovery links + tests.
Report the phase boundary reached if you cannot finish all three.
