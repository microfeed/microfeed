# PRD — Editor Workspace and TipTap Expansion

**Branch:** cut a new feature branch from `main` after the image-pipeline PRD is merged.  
**Companion:** [PRD_PERSONAL_SITE_EXECUTION_INDEX.md](./PRD_PERSONAL_SITE_EXECUTION_INDEX.md)

---

## 1. Goal

Make content authoring editor-first:

1. The main editor canvas gets priority over side rails.
2. Left and right rails become independently collapsible.
3. Desktop defaults to left rail closed, right rail open.
4. Mobile rails become overlays/drawers.
5. Primary save actions stay sticky in the main editor header.
6. TipTap gains the agreed authoring features using currently installable dependencies.
7. HTML source mode remains available only on selected rich-text fields.

This PRD prepares the authoring foundation for `home_page` and later content work.

---

## 2. Settled decisions

| Area | Decision |
|------|----------|
| Base branch | Start from `main`, after image-pipeline work is merged. |
| Left rail | Only the existing admin navigation. |
| Right rail | Item-specific data entry and metadata. |
| Desktop defaults | Left closed, right open. |
| Mobile | Rails become overlays/drawers. |
| Save actions | Sticky in the main editor header. |
| Live preview | Out of scope. |
| HTML mode | Available only on selected rich-text fields like blog/home/landing content. |
| TipTap dependency rule | Use only extensions installable with current dependencies. |
| Must-have TipTap features | H1-H6, bold, italic, underline, strike, blockquote, code block, bullet list, ordered list, task list, horizontal rule, image, text alignment, undo/redo, highlight. |
| Nice-to-have TipTap features | inline code, subscript, superscript, link/unlink, clear formatting. |
| Out now | tables. |

---

## 3. Architecture context (read first)

- `client-src/ClientAdminItemsApp/components/SchemaItemEditor/index.jsx`
- `client-src/ClientAdminItemsApp/components/ItemFormApp/index.jsx`
- `client-src/components/AdminNavApp/index.jsx`
- `client-src/components/FormRenderer/index.jsx`
- `client-src/components/AdminRichEditor/index.jsx`
- `client-src/components/AdminRichEditor/component/RichEditorTiptap/index.jsx`
- `client-src/components/AdminRichEditor/component/RichEditorMediaDialog/index.jsx`
- `client-src/common/admin_styles.css`
- `client-src/components/FormRenderer/widgets/index.js`
- `client-src/components/FormRenderer/FormRenderer.test.jsx`
- `client-src/ClientAdminItemsApp/components/SchemaItemEditor/SchemaItemEditor.test.jsx`
- `client-src/components/AdminRichEditor/component/RichEditorTiptap/RichEditorTiptap.test.jsx`

Current friction to eliminate:

- fixed `9/3` editor layout
- no collapse seam for rails
- rich-text toolbar too narrow for current personal-site needs
- editor chrome and field rendering are too entangled

---

## 4. Deliverables

### 4.1 Editor workspace shell

Reshape the item editor into a workspace shell that clearly separates:

- left admin-nav rail
- main editor canvas
- right item-data rail
- sticky editor header with primary actions

The shell must own collapse state and responsive layout behavior.

### 4.2 Independent collapsible rails

Add independent collapse/expand behavior for:

- left admin-nav rail
- right item-data rail

Behavioral requirements:

- desktop default: left closed, right open
- reopening either rail resizes the editor canvas rather than overlaying it
- mobile uses overlay/drawer behavior instead of shrinking inline columns

### 4.3 Main editor header

Move the primary save/update actions into a sticky main editor header.

The right rail may still surface contextual metadata, but save actions must remain accessible even when the right rail is collapsed.

### 4.4 Right-rail ownership cleanup

Treat the right rail as the single place for item-specific metadata such as:

- slug
- status
- SEO fields
- tags
- relations
- other non-primary authoring controls

The main editor canvas should focus on the content authoring experience rather than splitting attention with metadata-heavy forms.

### 4.5 TipTap feature expansion

Expand TipTap support using current installable dependencies to cover:

- headings H1-H6
- bold
- italic
- underline
- strike
- blockquote
- code block
- bullet list
- ordered list
- task list
- horizontal rule
- image insertion
- text alignment
- undo / redo
- highlight

If a nice-to-have feature is low-risk and available through current dependencies, it may be included, but must not endanger the must-have scope.

### 4.6 Raw HTML scope

Keep HTML source mode only for selected rich-text fields:

- blog body
- home-page rich-text content fields
- landing-page rich-text content fields

Do not automatically expose raw HTML mode to every rich-text field without need.

### 4.7 Image insertion integration

Image insertion inside TipTap must use the same image upload pipeline introduced by the image-pipeline PRD.

That means inserted non-animated raster images follow the same square/AVIF/max-size rules before embedding.

---

## 5. Implementation slices inside this issue

Implement in this order inside the same branch/PR:

1. Introduce the editor workspace shell and collapse-state behavior.
2. Move primary actions into the sticky main header.
3. Re-home right-rail responsibilities into the new shell.
4. Expand TipTap must-have features.
5. Restrict/preserve HTML mode to the agreed selected fields.
6. Rewire TipTap image insertion through the shared image pipeline.

Do not implement the `home_page` content type in this issue.

---

## 6. Tests to write first

1. Workspace layout behavior:
   - desktop default state = left closed / right open
   - left and right rails collapse independently
   - main editor canvas resizes when rails change
   - mobile behavior uses overlay/drawer semantics
2. Sticky header behavior:
   - primary save actions remain available with right rail collapsed
3. Right-rail ownership:
   - item metadata controls still render and persist through the right rail
4. TipTap must-have features:
   - toolbar controls render for must-have features
   - emitted HTML reflects feature behavior
   - HTML source mode remains available only on selected fields
5. TipTap image insertion:
   - inserted images go through the shared image pipeline

### Prior art

- `client-src/ClientAdminItemsApp/components/SchemaItemEditor/SchemaItemEditor.test.jsx`
- `client-src/components/FormRenderer/FormRenderer.test.jsx`
- `client-src/components/AdminRichEditor/AdminRichEditor.test.jsx`
- `client-src/components/AdminRichEditor/component/RichEditorTiptap/RichEditorTiptap.test.jsx`

---

## 7. Review protocol

The outsourced review must explicitly verify:

- no regression in save/update flows
- rails truly own layout state instead of ad hoc CSS duplication
- selected-field-only HTML mode is enforced
- must-have TipTap features exist and nice-to-have features did not silently replace required ones
- TipTap image insertion uses the shared image pipeline rather than a second upload path

---

## 8. Out of scope

- live preview pane
- tables
- new public routes
- `home_page` data model
- related-content data model

---

## 9. Acceptance

- Editor layout is editor-first, with left/right rails independently collapsible.
- Desktop default = left closed / right open.
- Mobile rails use overlays/drawers.
- Save/update actions are sticky in the main editor header.
- Right rail owns item-specific metadata.
- TipTap supports the agreed must-have feature set.
- HTML mode remains available only on selected fields.
- TipTap image insertion uses the shared image pipeline.
- `yarn test` is green and outsourced review finds no unresolved confirmed/plausible issues.
