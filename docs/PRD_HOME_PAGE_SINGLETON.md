# PRD — Home Page Singleton

**Branch:** cut a new feature branch from `main` after the editor-workspace PRD is merged.  
**Companion:** [PRD_PERSONAL_SITE_EXECUTION_INDEX.md](./PRD_PERSONAL_SITE_EXECUTION_INDEX.md)

---

## 1. Goal

Turn `/` into a true editable home-page singleton for a personal site:

1. Introduce a dedicated `home_page` content type.
2. Enforce exactly one home-page record.
3. Bind that singleton to `/` with no editable slug.
4. Support hybrid composition:
   - channel-field toggles
   - recent-items block
   - manual featured-items block
   - filtered content block
   - SEO fields
5. Keep home separate from generic `landing_page`, which remains available for other pages.

---

## 2. Settled decisions

| Area | Decision |
|------|----------|
| Base branch | Start from `main`, after editor-workspace work is merged. |
| Home model | Dedicated `home_page` content type. |
| Multiplicity | Exactly one `home_page`, hard-enforced. |
| URL | Hard-bound to `/`; no editable slug. |
| Relation to channel data | Toggle-based inclusion of selected channel fields inside home content. |
| Home composition | Mixed manual + filtered blocks. |
| Required editable fields | hero title, hero rich text, hero image, toggle for showing channel title/description/image, recent items block, manual featured items block, filtered content block, SEO fields. |
| Home recent block | Configurable content types + item count; also include useful low-risk controls where they add clear value. |
| Home filtered block | Include content types, tags, item count, sort, and manual section title. |
| Related content | Never render the related-content strip on home. |
| Generic landing pages | Stay available for non-home pages. |

---

## 3. Architecture context (read first)

- `edge-src/registry/ContentTypeRegistry.js`
- `edge-src/models/ContentService.js`
- `edge-src/models/AggregationResolver.js`
- `edge-src/models/ItemRepo.js`
- `functions/index.jsx`
- `edge-src/web/HomePage.jsx`
- `edge-src/web/RecordPageLayout.jsx`
- `client-src/ClientAdminItemsApp/components/SchemaItemEditor/index.jsx`
- `client-src/components/FormRenderer/index.jsx`
- `client-src/ClientAdminItemsApp/components/LandingPreview/index.jsx`

Current friction to eliminate:

- `/` is driven by channel data + recent items, not by a real home-page module
- there is no single authoritative edit surface for home
- current generic `landing_page` semantics do not capture the dedicated `/` contract

---

## 4. Deliverables

### 4.1 New `home_page` content type

Add a dedicated `home_page` content type to the registry.

This type must:

- be distinct from `landing_page`
- support singleton enforcement
- never expose editable slug controls
- include the agreed content/SEO fields

### 4.2 Singleton enforcement

Enforce exactly one `home_page`.

The system must prevent:

- creating a second `home_page`
- editing the singleton in a way that disconnects it from `/`

The implementation may choose the highest existing seam for enforcement, but the behavior must be explicit and tested.

### 4.3 Home-page data shape

The `home_page` content type must model:

- hero title
- hero rich text
- hero image
- booleans for showing channel title/description/image
- recent-items block
- manual featured-items block
- filtered content block
- SEO fields

The recent-items block must at minimum support:

- included content types
- item count

Recommended additional low-risk value controls for v1:

- show date
- show excerpt
- show badge

The filtered block must support:

- included content types
- tags
- item count
- sort
- manual section title

### 4.4 `/` route ownership

Update the home route so `/` resolves the `home_page` singleton first, then renders the composed home experience from that singleton.

Home rendering must remain compatible with:

- canonical brand/public image rules from the image-pipeline PRD
- shared card styling
- no related-content strip

### 4.5 Authoring surface

Wire the singleton into the admin flow so the home page is editable through the content system rather than implicit channel settings alone.

The authoring experience should reuse the schema-driven editor and workspace improvements rather than inventing a second editing surface.

### 4.6 Landing-page coexistence

Keep generic `landing_page` available for non-home pages.

No implicit migration of all landing pages into home semantics.

---

## 5. Implementation slices inside this issue

1. Add the `home_page` content type and its field definitions.
2. Add singleton enforcement.
3. Rewire `/` to load and render the singleton.
4. Add or adapt admin authoring flow for the singleton.
5. Make sure channel-field toggles, recent-items block, manual block, and filtered block all render correctly.
6. Confirm home excludes related-content rendering.

Do not mix in unrelated editor-workspace or related-content logic beyond what this PRD explicitly consumes.

---

## 6. Tests to write first

1. Registry/content-type tests:
   - `home_page` type exists with the expected field set
   - slug is not editable / not part of normal authoring payload contract
2. Singleton enforcement tests:
   - cannot create a second home-page record
   - `/` always resolves the singleton
3. Home route/render tests:
   - hero title, rich text, image render correctly
   - channel-field toggles change rendered output
   - recent-items block filters by content types and item count
   - manual featured-items block renders selected items
   - filtered block respects content types, tags, sort, item count
   - related-content strip is absent
4. Admin/editor tests:
   - singleton loads into authoring flow
   - slug is not editable

### Prior art

- `edge-src/web/HomePage.test.js`
- `edge-src/web/AggregatorPages.test.js`
- `edge-src/models/ContentService.test.js`
- `edge-src/registry/ContentTypeRegistry.test.js`
- `client-src/ClientAdminItemsApp/components/SchemaItemEditor/SchemaItemEditor.test.jsx`
- `client-src/ClientAdminItemsApp/components/LandingPreview/LandingPreview.test.jsx`

---

## 7. Review protocol

The outsourced review must explicitly verify:

- home truly has a singleton contract rather than a convention
- `/` is now owned by the singleton, not by ad hoc channel/recent-items assembly
- generic `landing_page` behavior remains available for non-home pages
- home does not accidentally inherit the related-content strip

---

## 8. Out of scope

- new table-based home-block architecture beyond what this issue needs
- live preview
- related-content implementation
- favicon behavior
- generic landing-page redesign unrelated to the singleton contract

---

## 9. Acceptance

- `home_page` exists as a dedicated content type.
- Exactly one home-page record is allowed.
- `/` renders from that singleton.
- Home supports the agreed hybrid fields/blocks.
- Channel-field toggles behave as configured.
- Generic `landing_page` remains available.
- Home never renders related-content.
- `yarn test` is green and outsourced review finds no unresolved confirmed/plausible findings.
