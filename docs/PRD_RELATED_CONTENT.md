# PRD — Related Content Module

**Branch:** cut a new feature branch from `main` after the home-page PRD is merged.  
**Companion:** [PRD_PERSONAL_SITE_EXECUTION_INDEX.md](./PRD_PERSONAL_SITE_EXECUTION_INDEX.md)

---

## 1. Goal

Add a consistent related-content module across all non-home public content:

1. Any non-home content type can relate to any other non-home content type.
2. Relations are two-way.
3. Public rendering shows up to 3 related items.
4. Ordering is based on related item updated date.
5. Rendering uses the same card style everywhere.
6. The public section heading is `Read next`.
7. Only published items can participate.

---

## 2. Settled decisions

| Area | Decision |
|------|----------|
| Base branch | Start from `main`, after home-page work is merged. |
| Scope | All non-home content, including blog, photo, podcast, gallery, and landing pages. |
| Target rule | Any non-home type can relate to any other non-home type. |
| Public visibility | Only published items participate. |
| Direction | Two-way. |
| Cap | Show at most 3 related items. |
| Ordering | Latest 3 by related item updated date. |
| Rendering | Same card style everywhere. |
| Heading | `Read next` |
| Home page | Explicitly excluded. |
| Data model | Dedicated relation type in `item_relations`, separate from gallery membership. |

---

## 3. Architecture context (read first)

- `edge-src/models/RelationRepo.js`
- `edge-src/models/ContentService.js`
- `edge-src/models/AggregationResolver.js`
- `edge-src/models/ItemRepo.js`
- `edge-src/web/ItemCard.jsx`
- `edge-src/web/BlogArticlePage.jsx`
- `edge-src/web/PhotoPage.jsx`
- `edge-src/web/PodcastEpisodePage.jsx`
- `edge-src/web/GalleryPage.jsx`
- `edge-src/web/LandingPage.jsx`
- `client-src/components/FormRenderer/widgets/GalleryCurator.jsx`
- `client-src/components/FormRenderer/widgets/index.js`
- `edge-src/registry/ContentTypeRegistry.js`

Current friction to eliminate:

- gallery membership already uses one relation path
- landing filtering uses a different aggregation path
- editorial related-content does not exist as a first-class module

---

## 4. Deliverables

### 4.1 Dedicated relation type

Add a new explicit relation type for related content in `item_relations`.

This must be separate from gallery membership so “related content” and “gallery members” do not share semantics.

### 4.2 Two-way relation behavior

When an editor relates item A to item B, the system must treat the relationship as two-way for public consumption.

The implementation may choose whether to persist both directions or derive reverse visibility, but the public contract must be:

- if A relates to B, B can surface A as related content too
- only published items count toward rendered output
- home never participates

### 4.3 Authoring flow

Expose related-content authoring in the editor for all non-home types.

The authoring flow must:

- restrict choices to published non-home content
- prevent home-page participation
- make the two-way contract clear through behavior
- not require manual ordering controls

### 4.4 Public resolver

Build a related-content resolver that:

- gathers candidate related items for a given public item
- removes unpublished targets
- sorts by related item updated date
- returns at most 3

### 4.5 Shared public renderer

Render the related-content strip with:

- heading `Read next`
- same card style across all supported public pages
- no special per-page layout variants in v1

Apply it to:

- blog detail pages
- photo detail pages
- podcast detail pages
- gallery pages
- landing pages

Do not apply it to home.

---

## 5. Implementation slices inside this issue

1. Add the relation type and relation-repo support.
2. Add authoring support in the editor for non-home content types.
3. Add the related-content resolver.
4. Add shared public rendering.
5. Thread the strip into all supported public pages except home.

Do not broaden into recommendation/search/tag-based heuristics beyond explicit relations.

---

## 6. Tests to write first

1. Relation/persistence tests:
   - related-content relation type persists independently from gallery membership
   - home cannot participate
   - unpublished items are excluded
2. Resolver tests:
   - two-way visibility works
   - output is capped at 3
   - ordering uses related item updated date
3. Authoring tests:
   - related-content selection is available for non-home types
   - home is excluded
   - only published candidates are selectable
4. Public rendering tests:
   - supported page types render `Read next`
   - cards use the shared card style
   - home does not render the strip

### Prior art

- `edge-src/models/RelationRepo.test.js`
- `edge-src/models/ContentService.test.js`
- `edge-src/web/RecordPages.test.js`
- `edge-src/web/AggregatorPages.test.js`
- `edge-src/web/ItemCard.test.js`
- `client-src/components/FormRenderer/widgets/GalleryCurator.test.jsx`

---

## 7. Review protocol

The outsourced review must explicitly verify:

- related-content relations are distinct from gallery-member relations
- public two-way behavior matches the PRD
- only published non-home content participates
- home remains excluded
- page templates do not fork card styling for related-content

---

## 8. Out of scope

- recommendation engines
- tag-similarity auto-suggestions
- manual order controls
- >3 rendered related items
- home-page related-content

---

## 9. Acceptance

- Any non-home published content can relate to any other non-home published content.
- Relations behave two-way for public rendering.
- Public pages render at most 3 related items ordered by related item updated date.
- Heading is `Read next`.
- Card style is consistent across all supported public pages.
- Home never renders the strip.
- `yarn test` is green and outsourced review finds no unresolved confirmed/plausible findings.
