# PRD — Public Site: Nav Bar, Home Page & Type Listing Pages

**Branch:** `feat/public-site-nav-home` (branched off the merged rebuild). Do NOT commit to `main` or `rebuild/cms`.
**Companion rules:** obey [`docs/AGENT_PROMPTS.md`](./AGENT_PROMPTS.md) "Shared rules" — tests-first, `yarn test` green before stop, touch only needed files, parameterized SQL, no scope creep.
**Content-type field spec:** [`docs/CONTENT_TYPES.md`](./CONTENT_TYPES.md).

---

## 1. Goal

The public-facing site currently renders bare pages with **no navigation** and a **minimal home page** (flat `<ul>` of links). Build a proper public experience:

1. A **public nav bar** on every public page.
2. A **hero + enriched feed** home page.
3. **Per-type listing pages** (all blog articles, all photos, all podcast episodes).

This is public-site presentation only. No changes to admin UI, data layer, registry, or API.

---

## 2. Settled decisions (do not re-decide)

| Area | Decision |
|------|----------|
| Nav links | Brand (channel image/logo → home) + **dynamic** type links. A type link shows **only if that type has ≥1 published item**. |
| Nav types | Record family only: `blog_article` → "Blog", `photo` → "Photos", `podcast_episode` → "Podcast". Aggregators (gallery, landing_page) NOT in nav (deferred). |
| Home layout | **Hero + feed**: channel hero (cover image + title + description) on top, then a single chronological **enriched card feed** below. |
| Branding | Use `channel.image` as hero banner and as small nav logo. **Fallback to text title** when `channel.image` is empty. |
| Listing pages | Build index routes at the **existing detail-prefix roots**: `/blog/` (blog_article), `/photo/` (photo), `/i/` (podcast_episode). Reuse `itemPublicUrl.js` prefixes — no new URL scheme. |
| Listing pagination | Paginated using the existing `ItemRepo` / `Paginator` cursor pagination. |
| Nav scope | Nav appears on **all public pages**: home, record detail pages, aggregator pages, and the new listing pages. |
| Styling | Inline CSS in the shared layout (no external CSS / Mustache — matches Task 6.3a `RecordPageLayout` inline-style approach). Light/dark via `prefers-color-scheme`. |

---

## 3. Architecture context (read these first)

- Home handler: [`functions/index.jsx`](../functions/index.jsx) — fetches channel + latest 20 published record items, renders `HomePage`.
- Home component: [`edge-src/web/HomePage.jsx`](../edge-src/web/HomePage.jsx).
- Shared public layout: [`edge-src/web/RecordPageLayout.jsx`](../edge-src/web/RecordPageLayout.jsx) — wraps `<html><head><style>…</head><body><main>`. **This is where the nav belongs** so every public page inherits it.
- Record detail pages (already use the layout): `BlogArticlePage.jsx`, `PhotoPage.jsx`, `PodcastEpisodePage.jsx`, plus aggregator `GalleryPage.jsx`, `LandingPage.jsx`.
- URL prefix table: [`edge-src/web/itemPublicUrl.js`](../edge-src/web/itemPublicUrl.js) — `podcast_episode:/i/`, `blog_article:/blog/`, `photo:/photo/`.
- Item read: [`edge-src/models/ItemRepo.js`](../edge-src/models/ItemRepo.js) — `list({queryKwargs, orderBy, limit})` and `listPaginated(options)`.
- Serializer: [`edge-src/models/FeedItemSerializer.js`](../edge-src/models/FeedItemSerializer.js) — `serializeItemForFeed(row, {publicBucketUrl})` yields a public item (title, image, excerpt/content, etc.). Use it; do not re-parse `data` by hand.
- Registry: [`edge-src/registry/ContentTypeRegistry.js`](../edge-src/registry/ContentTypeRegistry.js) — `listTypes()` (each has `name`, `family`), filter `family === "record"`.
- Constants: [`common-src/Constants.js`](../common-src/Constants.js) — `STATUSES.PUBLISHED`.
- Render helper: `renderReactToHtml` from `edge-src/common/PageUtils`.
- Detail route to mirror for listings: [`functions/i/[slug]/index.jsx`](../functions/i/[slug]/index.jsx), `functions/blog/[slug]/index.jsx`, `functions/photo/[slug]/index.jsx`.

---

## 4. Deliverables

### 4.1 Public nav bar (shared)
- New component `edge-src/web/PublicNav.jsx`.
- Props: `channel` (for brand image/title + home link) and `navTypes` — an array of `{name, label, href}` for the record types that currently have published content.
- Brand: renders `channel.image` as a small logo `<img>` linking `/`; if empty, renders `channel.title` text linking `/`.
- Links: one per entry in `navTypes` (label + href). Empty `navTypes` → brand only.
- Render inside `RecordPageLayout`'s `<body>` above `<main>` (so all public pages get it). Add a `navTypes` prop to `RecordPageLayout` (default `[]`) and thread it through.
- **Nav-types computation must be shared, not duplicated.** Add a helper, e.g. `edge-src/web/publicNavTypes.js` → `async function getPublicNavTypes(itemRepo)` returning the record types (label + href from `itemPublicUrl` prefix root) that have ≥1 `STATUSES.PUBLISHED` item. Every public route calls it to populate the nav. Keep the type→label map in one place.
- Labels: `blog_article`→"Blog", `photo`→"Photos", `podcast_episode`→"Podcast". Href = the type's prefix root from `itemPublicUrl.js` (`/blog/`, `/photo/`, `/i/`).
- Style: sticky top bar, inline CSS added to `RecordPageLayout` `INLINE_STYLES`. Must degrade on mobile (flex-wrap). Dark-mode aware.

### 4.2 Home page (hero + feed)
- Update [`edge-src/web/HomePage.jsx`](../edge-src/web/HomePage.jsx):
  - **Hero**: `channel.image` as banner (if present) + `channel.title` H1 + `channel.description`. Text-only hero when no image.
  - **Feed**: replace the flat `<ul>` with enriched cards — each card shows the item's thumbnail/cover (if any), title, and short excerpt/caption, plus a small **type badge** (Blog / Photo / Podcast), linking via `itemPublicUrl(content_type, slug)`.
  - Keep it accessible (semantic `<article>`/`<a>`), inline-styled, dark-mode aware.
- Update [`functions/index.jsx`](../functions/index.jsx) to compute `navTypes` via the shared helper and pass to `HomePage` (which passes to layout).

### 4.3 Type listing pages (new routes)
Create three index routes, each: fetch published items of one type, paginate, render a listing page reusing the enriched card feed + nav + layout.
- `functions/blog/index.jsx` → `blog_article`
- `functions/photo/index.jsx` → `photo`
- `functions/i/index.jsx` → `podcast_episode`
- New component `edge-src/web/TypeListingPage.jsx` (title = type label, feed of cards, prev/next pagination controls). Reuse the same card markup as home (extract a shared `ItemCard.jsx` used by both HomePage feed and TypeListingPage — avoid duplicate card code).
- Pagination: use `ItemRepo.listPaginated` (cursor-based). Wire prev/next links with the cursor query params it expects. Empty result → friendly "No items yet" state.
- Each listing sets its own `canonicalUrl` (prefix root) and `<title>`.

### 4.4 Shared card
- `edge-src/web/ItemCard.jsx` — one card component consumed by HomePage feed and TypeListingPage. Input: a serialized public item (+ its `content_type`/`slug`). Renders thumbnail, title, excerpt, type badge, correct href.

---

## 5. Tests (tests-first — write RED, then GREEN)

React component tests: add `/** @jest-environment jsdom */` at top; use `@testing-library/react`. Follow existing `edge-src/web/RecordPages.test.js` / `AggregatorPages.test.js` patterns.

1. **PublicNav.test.js** — renders brand image when `channel.image` set; falls back to title text when empty; renders exactly the links passed in `navTypes`; renders brand-only when `navTypes` empty.
2. **publicNavTypes.test.js** — helper returns only record types with ≥1 published item; excludes types with zero published items; excludes aggregators; correct label + href per type. (Integration against the Phase 0 better-sqlite3 harness / mocked ItemRepo — mirror existing repo tests.)
3. **HomePage.test.js** — hero shows channel image + title + description; feed renders one card per item with correct href and type badge; text-only hero when no image; nav present.
4. **ItemCard.test.js** — renders title, excerpt, thumbnail, badge, and href from `itemPublicUrl` for each content_type; handles missing thumbnail/excerpt gracefully.
5. **TypeListingPage.test.js** — renders N cards for N items; shows empty state when none; renders prev/next controls when pagination cursors present; nav present.
6. **Route tests** (mirror existing handler tests if present) for `functions/blog/index.jsx`, `functions/photo/index.jsx`, `functions/i/index.jsx` — returns 200 HTML listing only PUBLISHED items of the right type; nav populated.

Run `yarn test` — everything green before stopping. If native addon issues arise, rebuild per AGENT_PROMPTS (`fnm exec --using 22 -- corepack yarn@4.9.2 rebuild better-sqlite3`).

---

## 6. Out of scope (do NOT build)
- Admin UI, data layer, registry, API changes.
- Aggregator (gallery / landing_page) nav links or their own listing indexes.
- Search, filtering, tag pages, RSS/JSON changes.
- New content types or fields.
- External CSS / theme system / Mustache.

---

## 7. Acceptance
- Every public page (home, detail, listing, aggregator) shows the nav bar.
- Nav shows brand + only the record types that have published items.
- Home = hero (channel image/title/description) + enriched card feed.
- `/blog/`, `/photo/`, `/i/` list all published items of their type, paginated, with working prev/next.
- No duplicated card or nav-type logic (shared `ItemCard`, shared nav-types helper).
- `yarn test` green. No changes outside public-site files + their tests.
