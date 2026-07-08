# PRD — Aggregator Nav & Listings (galleries + landing pages)

**Branch:** `feat/aggregator-nav-listings` (already checked out). Do NOT commit to `main`.
**Builds on:** the shipped public-site work (`docs/PRD_PUBLIC_SITE.md`) — reuse `PublicNav`, `ItemCard`, `TypeListingPage`, `resolveTypeListingPage`, `publicNavTypes`. Obey `docs/AGENT_PROMPTS.md` shared rules (tests-first, `yarn test` green, parameterized SQL, minimal scope).

---

## 1. Goal

Extend the public nav + listings to cover the two **aggregator** content types:

1. **Galleries** — a `/gallery/` index page listing all published galleries, plus a dynamic **"Galleries"** nav link (shown only when ≥1 published gallery exists).
2. **Landing pages** — each `landing_page` gets an admin-set **`show_in_nav`** flag; only flagged, published landing pages appear as their own top-level nav links (`title → /<slug>`).

---

## 2. Settled decisions (do not re-decide)

| Area | Decision |
|------|----------|
| Gallery listing | New route `/gallery/` (`functions/gallery/index.jsx`) lists all published galleries as cards (cover image + title) using the existing `ItemCard` + `TypeListingPage` + `resolveTypeListingPage` pattern (`contentType="gallery"`). Cursor-paginated. Empty state. |
| Gallery nav link | Dynamic "Galleries" link → `/gallery/`, shown only if ≥1 published gallery. |
| Landing pages in nav | Add a `show_in_nav` **boolean** field to the `landing_page` registry type. Only landing pages with `show_in_nav === true` **and** a visible status appear in nav, each as `{label: title, href: /<slug>}`. Default (field absent/false) = not in nav. |
| Landing nav data source | `show_in_nav` lives inside the item's `data` JSON (not a table column), so `QueryBuilder` **cannot** filter it. The nav helper must fetch published landing pages and filter `show_in_nav` **in JS**. Landing pages are few; fetch with a sane limit (e.g. 50). |
| Nav order | Record-type links (Blog/Photos/Podcast) → Galleries → flagged landing pages. |
| Admin | No admin-code changes needed: the editor (`SchemaItemEditor` → `FormRenderer` → `BooleanWidget`) is data-driven, so adding the registry field auto-renders a checkbox. Confirm with a test, do not hand-edit admin forms. |

---

## 3. Architecture context (read first)

- Registry: `edge-src/registry/ContentTypeRegistry.js` — `landing_page` fieldDefs (~line 114). `makeFieldDef(key, kind, {target, source, ...})`; boolean kind supported. Add `makeFieldDef("show_in_nav", "boolean", {target: "showInNav", source: "showInNav"})`.
- Field kinds: `edge-src/registry/fieldKinds.js` — boolean `validate`/`toInternal`/`toPublic` already exist.
- Serializer: `edge-src/models/FeedItemSerializer.js` — `serializeItemForFeed` is data-driven; `showInNav` will surface as `item.showInNav` automatically (undefined when unset — treat as false).
- Existing nav helper: `edge-src/web/publicNavTypes.js` — `getPublicNavTypes(itemRepo)`. Extend or add a sibling.
- Existing listing plumbing: `edge-src/web/resolveTypeListingPage.js`, `edge-src/web/TypeListingPage.jsx`, `edge-src/web/ItemCard.jsx`.
- Nav component: `edge-src/web/PublicNav.jsx` — renders `navTypes` links today.
- Layout that injects nav on every page: `edge-src/web/RecordPageLayout.jsx` (takes `channel`, `navTypes`).
- Aggregator resolve/render prior art: `edge-src/web/resolveAggregatorPage.js`, `functions/gallery/[slug]/index.jsx`, `functions/[slug]/index.jsx` (landing pages live at root `/<slug>`).
- URL prefixes: `edge-src/web/itemPublicUrl.js` — `gallery:/gallery/`, `landing_page:/`.
- `ItemRepo` (`.list`, `.listPaginated`), `STATUSES` in `common-src/Constants.js` (PUBLISHED; note aggregator pages also honor UNLISTED for direct view — but **nav/listing show PUBLISHED only**).

---

## 4. Deliverables

### 4.1 Registry field
- Add `show_in_nav` boolean field to `landing_page` in `ContentTypeRegistry.js` (`target/source: "showInNav"`). No other type changes.

### 4.2 Nav helper — unify into public nav links
- Extend the nav helper module so a single call produces the **full ordered nav-link list**. Suggested: keep `getPublicNavTypes` (record types) and add `getPublicNavLinks(itemRepo)` that returns `[...recordTypeLinks, ...galleryLink, ...landingPageLinks]`, each `{name, label, href}`.
  - **Gallery link**: query published galleries `limit: 1`; if any, push `{name:"gallery", label:"Galleries", href: itemPublicUrl("gallery","")}` (→ `/gallery/`).
  - **Landing links**: fetch published `landing_page` items (`limit: 50`), serialize (or read data), filter `showInNav === true`, map to `{name: "landing:"+slug, label: title, href: itemPublicUrl("landing_page", slug)}` (→ `/<slug>`). Preserve a stable order (e.g. `pub_date desc` or title).
- Keep the type→label map single-source (extend the existing `NAV_TYPE_LABELS` / add gallery label in one place). No duplicated tables.
- Update every public route + `resolveTypeListingPage` to populate the nav via the unified helper so galleries + landing links appear on **all** public pages (home, detail, record listings, gallery listing).

### 4.3 Gallery listing route
- `functions/gallery/index.jsx` — mirror `functions/blog/index.jsx`: `resolveTypeListingPage(env, request, "gallery")`, render `TypeListingPage` with `typeLabel="Galleries"`, `basePath="/gallery/"`, `canonicalUrl` = `${origin}/gallery/`, cursor pagination, nav from the unified helper.
- `ItemCard` already handles gallery items (they have `image` + `title`, and `itemPublicUrl("gallery", slug)` → `/gallery/<slug>`). Confirm the badge label for gallery (add `gallery: "Gallery"` to `ItemCard` BADGE_LABELS).

### 4.4 PublicNav
- `PublicNav` already maps `navTypes` → links; ensure it renders the combined list unchanged (record + gallery + landing). No structural change beyond consuming the richer array. Verify keys are unique (landing keys prefixed).

---

## 5. Tests (tests-first — RED → GREEN)

React tests: `/** @jest-environment jsdom */` + `@testing-library/react`. Mirror existing `publicNavTypes.test.js`, `TypeListingRoutes.test.js`, `ContentTypeRegistry.test.js`.

1. **ContentTypeRegistry.test.js** — assert `landing_page` now has a `show_in_nav` boolean fieldDef (`target/source: showInNav`); other types unchanged.
2. **Serializer test** — a landing_page row with `data.showInNav=true` serializes to `item.showInNav === true`; absent → undefined/false. (Extend existing serializer tests.)
3. **nav-links helper test** (extend `publicNavTypes.test.js` or new `publicNavLinks.test.js`) — returns "Galleries" link only when ≥1 published gallery; includes only `showInNav===true` published landing pages with correct label(title)+href(`/<slug>`); excludes unflagged / unpublished landing pages; correct overall order (types → gallery → landing).
4. **Gallery listing route test** (extend `TypeListingRoutes.test.js`) — `functions/gallery/index.jsx` returns 200 HTML listing only PUBLISHED galleries; nav populated; empty state when none.
5. **PublicNav.test.js** — renders a mixed link array (record + Galleries + a landing page) with unique keys and correct hrefs.
6. **Admin data-driven check** — a test asserting the landing_page field set the editor renders (via `getFieldDefs("landing_page")`) now includes `show_in_nav` so the admin form surfaces it (no admin-code change). Mirror `SchemaItemEditor.test.jsx` style if practical; a registry-level assertion is acceptable.

Run `yarn test` — all green (existing 268 + new). If native addon issues: `fnm exec --using 22 -- corepack yarn@4.9.2 rebuild better-sqlite3`.

---

## 6. Out of scope
- No changes to record types, API handlers, AggregationResolver, or the landing-page rendering itself.
- No landing-page listing index (they're individual nav destinations by design).
- No reordering UI for nav; order is derived, not user-sortable.
- No new deps.

---

## 7. Acceptance
- `/gallery/` lists published galleries (cards + pagination + empty state); nav shows "Galleries" only when galleries exist.
- Admin landing_page editor shows a `show_in_nav` checkbox (auto, data-driven).
- Only published landing pages with `show_in_nav` checked appear in the nav, linking `/<slug>`; order = types → Galleries → landing pages.
- Nav (with new links) appears on every public page.
- No duplicated nav-label or card logic. `yarn test` fully green. Changes limited to: registry (1 field), nav helper, gallery route, ItemCard badge, and tests.
