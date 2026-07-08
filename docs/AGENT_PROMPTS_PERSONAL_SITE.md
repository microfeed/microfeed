# Agent Prompts — microfeed personal-site rebuild

Copy-paste one block per issue into a fresh implementation-agent session. One issue = one session = one branch = one PR. Companion docs:

- [PRD_PERSONAL_SITE_EXECUTION_INDEX.md](./PRD_PERSONAL_SITE_EXECUTION_INDEX.md)
- [PRD_IMAGE_PIPELINE_AND_BRAND_MODEL.md](./PRD_IMAGE_PIPELINE_AND_BRAND_MODEL.md)
- [PRD_EDITOR_WORKSPACE_AND_TIPTAP.md](./PRD_EDITOR_WORKSPACE_AND_TIPTAP.md)
- [PRD_HOME_PAGE_SINGLETON.md](./PRD_HOME_PAGE_SINGLETON.md)
- [PRD_RELATED_CONTENT.md](./PRD_RELATED_CONTENT.md)

Tracker issues:

- `#18` Image pipeline and unified brand model
- `#19` Editor workspace and TipTap expansion
- `#20` Home page singleton
- `#21` Related content module

## Shared rules (every task obeys these)

- **Branch:** cut a new feature branch from `main` for this issue only. Never stack unrelated work. Merge the PR before starting the next issue.
- Repo: `microfeed`. Issues live on fork `kiran-brahma/microfeed`. **Read the exact PRD doc + matching GitHub issue before coding.** Do not re-decide settled product or architecture choices.
- **Tests-first is mandatory:** write or adjust the failing tests first, run them, confirm RED, then implement to GREEN.
- **React component tests:** add `/** @jest-environment jsdom */` at the top when needed; use Testing Library.
- **Node/runtime:** use Node 22 for test runs touching `better-sqlite3`. If native addon issues appear, use `fnm exec --using 22 -- corepack yarn@4.9.2 ...`.
- **Dep installs:** use `corepack yarn@4.9.2 add …`. After any install touching native modules, rebuild `better-sqlite3` under Node 22.
- Touch **only** the files this issue needs. No scope creep. No opportunistic cleanup unless the PRD explicitly requires it.
- Prefer the **highest existing seam** in the repo. Do not add a new seam when an existing repo seam already fits.
- **Stop and ask** instead of assuming if:
  - a PRD decision conflicts with current code in a way that changes product behavior
  - a required dependency is missing
  - a required upstream branch/PR state is unavailable
  - the PRD leaves a decision open
- **When code-complete + green, STOP and run the reviewer prompt** at the bottom of this file in a sub-agent. Fix findings, re-run tests, then stop.
- No parallel source-code work. This plan is strictly sequential.

## Required implementation loop

1. Read the matching PRD doc and matching GitHub issue.
2. Inspect the exact files named in the PRD’s “Architecture context”.
3. Write or adjust the smallest failing tests covering the required seam.
4. Run the smallest relevant test set and confirm RED.
5. Implement the smallest code change that can make the tests pass.
6. Re-run the same tests and confirm GREEN.
7. Run the broader relevant suite for the touched seam.
8. Self-review against the issue checklist.
9. Outsource review using the reviewer prompt below.
10. Fix all confirmed/plausible findings.
11. Re-run the relevant tests.
12. Stop only when green.

## Issue 18 — Image pipeline and unified brand model

### Prompt block
> Implement GitHub issue `#18` for `kiran-brahma/microfeed`: **Image pipeline and unified brand model**. Base branch = `main`; cut a fresh feature branch for this issue only. Read `docs/PRD_PERSONAL_SITE_EXECUTION_INDEX.md`, `docs/PRD_IMAGE_PIPELINE_AND_BRAND_MODEL.md`, and issue `#18` first. Do not re-decide anything in those docs.
>
> Deliver the issue exactly as specified:
> 1. Build one shared client-side image pipeline module for image-field uploads.
> 2. Rewire image-field uploaders to use that shared flow.
> 3. Rewire image replacement to use that same normalization flow.
> 4. Unify the canonical global brand/public image source around `channel.image`.
> 5. Clean up public presentation rules that depend on the canonical image source.
>
> Product rules that are fixed:
> - non-animated raster image-field uploads become square AVIF, max `1024x1024`, never upscaled
> - animated images are allowed in image fields and bypass AVIF normalization
> - SVG is allowed untouched
> - favicon is out of scope
> - replacements use the same new pipeline
> - existing stored media remains unchanged until replaced
> - public logo is max `50x50` with letterboxing
> - `channel.image` is the single canonical global brand/public image field
>
> Tests-first. Start by adding failing tests for:
> - shared image pipeline behavior
> - shared image-field uploader behavior
> - replacement-path normalization
> - final metadata behavior
> - public logo / square-thumbnail rendering
> - canonical image-source usage
>
> Files/modules to inspect first:
> - `client-src/components/AdminImageUploaderApp/index.jsx`
> - `client-src/components/FormRenderer/widgets/ImageUploadWidget.jsx`
> - `client-src/common/requests.js`
> - `client-src/ClientAdminChannelApp/components/EditChannelApp/index.jsx`
> - `client-src/ClientAdminSettingsApp/components/SeoSettingsApp/index.jsx`
> - `client-src/ClientAdminSettingsApp/components/WebGlobalSettingsApp/index.jsx`
> - `edge-src/models/MediaService.js`
> - `edge-src/web/publicChannel.js`
> - `edge-src/web/RecordPageLayout.jsx`
> - `edge-src/web/HomePage.jsx`
> - `edge-src/web/ItemCard.jsx`
> - `edge-src/web/seo/buildSeo.js`
>
> Prior-art tests:
> - `client-src/components/FormRenderer/widgets/MediaWidgets.test.jsx`
> - `edge-src/web/PublicNav.test.js`
> - `edge-src/web/publicChannel.test.js`
> - `edge-src/web/seo/buildSeo.test.js`
> - `edge-src/models/MediaService.test.js`
>
> Acceptance gate:
> - every non-animated raster image-field upload becomes square AVIF at max `1024x1024`
> - animated and SVG exception rules hold exactly
> - replacements use the same pipeline
> - `channel.image` is the active canonical public image source
> - public logo/card image rules are consistent
> - relevant tests green
>
> Do not start issue `#19`, `#20`, or `#21` work in this branch. Stop and ask if any missing dependency or contradictory product behavior appears.

## Issue 19 — Editor workspace and TipTap expansion

### Prompt block
> Implement GitHub issue `#19` for `kiran-brahma/microfeed`: **Editor workspace and TipTap expansion**. Base branch = `main`; cut a fresh feature branch after issue `#18` is merged. Read `docs/PRD_PERSONAL_SITE_EXECUTION_INDEX.md`, `docs/PRD_EDITOR_WORKSPACE_AND_TIPTAP.md`, and issue `#19` first. Do not re-decide anything in those docs.
>
> Deliver the issue exactly as specified:
> 1. Introduce an editor-first workspace shell.
> 2. Make left and right rails independently collapsible.
> 3. Desktop default = left closed / right open.
> 4. Mobile rails become overlays/drawers.
> 5. Move primary save/update actions into the sticky main editor header.
> 6. Re-home right-rail metadata responsibilities into the new shell.
> 7. Expand TipTap using only currently installable dependencies.
> 8. Keep HTML source mode only for selected rich-text fields.
> 9. Rewire TipTap image insertion through the shared image pipeline from issue `#18`.
>
> Fixed product rules:
> - left rail = existing admin navigation only
> - right rail = item-specific metadata and data entry
> - live preview is out of scope
> - tables are out of scope
> - TipTap must-have features: H1-H6, bold, italic, underline, strike, blockquote, code block, bullet list, ordered list, task list, horizontal rule, image, text alignment, undo/redo, highlight
> - nice-to-have only: inline code, subscript, superscript, link/unlink, clear formatting
> - raw HTML mode only for selected fields like blog/home/landing rich text
>
> Tests-first. Start by adding failing tests for:
> - workspace layout behavior
> - sticky main header actions
> - right-rail metadata ownership
> - TipTap must-have feature availability and HTML output
> - selected-field-only HTML mode
> - TipTap image insertion via the shared pipeline
>
> Files/modules to inspect first:
> - `client-src/ClientAdminItemsApp/components/SchemaItemEditor/index.jsx`
> - `client-src/ClientAdminItemsApp/components/ItemFormApp/index.jsx`
> - `client-src/components/AdminNavApp/index.jsx`
> - `client-src/components/FormRenderer/index.jsx`
> - `client-src/components/AdminRichEditor/index.jsx`
> - `client-src/components/AdminRichEditor/component/RichEditorTiptap/index.jsx`
> - `client-src/components/AdminRichEditor/component/RichEditorMediaDialog/index.jsx`
> - `client-src/common/admin_styles.css`
>
> Prior-art tests:
> - `client-src/ClientAdminItemsApp/components/SchemaItemEditor/SchemaItemEditor.test.jsx`
> - `client-src/components/FormRenderer/FormRenderer.test.jsx`
> - `client-src/components/AdminRichEditor/AdminRichEditor.test.jsx`
> - `client-src/components/AdminRichEditor/component/RichEditorTiptap/RichEditorTiptap.test.jsx`
>
> Acceptance gate:
> - editor layout is editor-first
> - rails collapse independently
> - desktop/mobile defaults behave as specified
> - save actions stay accessible in the sticky header
> - must-have TipTap features are present
> - selected-field-only HTML mode is preserved
> - TipTap image insertion uses issue `#18`’s pipeline
> - relevant tests green
>
> Do not implement `home_page` or related-content in this branch.

## Issue 20 — Home page singleton

### Prompt block
> Implement GitHub issue `#20` for `kiran-brahma/microfeed`: **Home page singleton**. Base branch = `main`; cut a fresh feature branch after issue `#19` is merged. Read `docs/PRD_PERSONAL_SITE_EXECUTION_INDEX.md`, `docs/PRD_HOME_PAGE_SINGLETON.md`, and issue `#20` first. Do not re-decide anything in those docs.
>
> Deliver the issue exactly as specified:
> 1. Add a dedicated `home_page` content type.
> 2. Enforce exactly one `home_page`.
> 3. Bind it to `/` with no editable slug.
> 4. Rewire the home route to render from the singleton.
> 5. Support the agreed hybrid composition model.
> 6. Reuse the schema-driven/editor workspace approach; do not invent a second editor surface.
> 7. Keep generic `landing_page` available for non-home use.
>
> Fixed product rules:
> - `home_page` is distinct from `landing_page`
> - singleton is hard-enforced
> - home uses toggle-based inclusion of selected channel fields
> - required editable areas: hero title, hero rich text, hero image, channel title/description/image toggles, recent-items block, manual featured-items block, filtered content block, SEO fields
> - recent-items block must support included content types + item count, and may add low-risk value toggles like show date/excerpt/badge
> - filtered block must support content types, tags, item count, sort, and manual section title
> - home never renders related-content
>
> Tests-first. Start by adding failing tests for:
> - `home_page` registry/content-type shape
> - singleton enforcement
> - `/` route ownership
> - channel-field toggle rendering
> - recent/manual/filtered block rendering
> - absence of related-content on home
> - admin/editor loading of the singleton with no editable slug
>
> Files/modules to inspect first:
> - `edge-src/registry/ContentTypeRegistry.js`
> - `edge-src/models/ContentService.js`
> - `edge-src/models/AggregationResolver.js`
> - `edge-src/models/ItemRepo.js`
> - `functions/index.jsx`
> - `edge-src/web/HomePage.jsx`
> - `edge-src/web/RecordPageLayout.jsx`
> - `client-src/ClientAdminItemsApp/components/SchemaItemEditor/index.jsx`
> - `client-src/components/FormRenderer/index.jsx`
> - `client-src/ClientAdminItemsApp/components/LandingPreview/index.jsx`
>
> Prior-art tests:
> - `edge-src/web/HomePage.test.js`
> - `edge-src/web/AggregatorPages.test.js`
> - `edge-src/models/ContentService.test.js`
> - `edge-src/registry/ContentTypeRegistry.test.js`
> - `client-src/ClientAdminItemsApp/components/SchemaItemEditor/SchemaItemEditor.test.jsx`
>
> Acceptance gate:
> - `home_page` exists and is singleton-enforced
> - `/` resolves from the singleton
> - hybrid composition works as specified
> - generic `landing_page` remains available
> - home excludes related-content
> - relevant tests green
>
> Do not implement issue `#21` in this branch.

## Issue 21 — Related content module

### Prompt block
> Implement GitHub issue `#21` for `kiran-brahma/microfeed`: **Related content module**. Base branch = `main`; cut a fresh feature branch after issue `#20` is merged. Read `docs/PRD_PERSONAL_SITE_EXECUTION_INDEX.md`, `docs/PRD_RELATED_CONTENT.md`, and issue `#21` first. Do not re-decide anything in those docs.
>
> Deliver the issue exactly as specified:
> 1. Add a dedicated related-content relation type in `item_relations`, separate from gallery membership.
> 2. Add authoring support for all non-home types.
> 3. Restrict related-content candidates to published non-home content.
> 4. Implement two-way public behavior.
> 5. Resolve and render at most 3 related items.
> 6. Sort by related item updated date.
> 7. Render the shared strip on blog, photo, podcast, gallery, and landing pages.
> 8. Never render related-content on home.
>
> Fixed product rules:
> - any non-home type can relate to any other non-home type
> - published-only participation
> - two-way behavior
> - max 3 rendered
> - heading = `Read next`
> - same card style everywhere
> - no recommendation engine, no tag-similarity heuristics, no manual order controls
>
> Tests-first. Start by adding failing tests for:
> - relation persistence separated from gallery membership
> - home exclusion
> - published-only filtering
> - two-way resolver behavior
> - max-3 cap
> - ordering by related item updated date
> - editor authoring support for non-home types
> - `Read next` rendering on all supported public page types
>
> Files/modules to inspect first:
> - `edge-src/models/RelationRepo.js`
> - `edge-src/models/ContentService.js`
> - `edge-src/models/AggregationResolver.js`
> - `edge-src/models/ItemRepo.js`
> - `edge-src/web/ItemCard.jsx`
> - `edge-src/web/BlogArticlePage.jsx`
> - `edge-src/web/PhotoPage.jsx`
> - `edge-src/web/PodcastEpisodePage.jsx`
> - `edge-src/web/GalleryPage.jsx`
> - `edge-src/web/LandingPage.jsx`
> - `client-src/components/FormRenderer/widgets/GalleryCurator.jsx`
> - `client-src/components/FormRenderer/widgets/index.js`
>
> Prior-art tests:
> - `edge-src/models/RelationRepo.test.js`
> - `edge-src/models/ContentService.test.js`
> - `edge-src/web/RecordPages.test.js`
> - `edge-src/web/AggregatorPages.test.js`
> - `edge-src/web/ItemCard.test.js`
> - `client-src/components/FormRenderer/widgets/GalleryCurator.test.jsx`
>
> Acceptance gate:
> - non-home published content can relate to any other non-home published content
> - related-content is distinct from gallery-member relations
> - public behavior is two-way
> - ordering/cap rules hold
> - `Read next` renders consistently
> - home remains excluded
> - relevant tests green

## Reviewer prompt (run after every issue, in a sub-agent)

> You are reviewing ONE completed personal-site issue for `microfeed`. Read the exact PRD doc, the matching GitHub issue, and `docs/PRD_PERSONAL_SITE_EXECUTION_INDEX.md`. Review only the diff for this issue. Verify the full checklist and report CONFIRMED/PLAUSIBLE findings, most-severe first:
> 1. **Tests-first discipline** — changed seam has new/updated tests, the issue appears to have followed red→green, and the relevant suite is green.
> 2. **Spec conformance** — the implementation satisfies the PRD and issue body line by line; flag any gap or silent reinterpretation.
> 3. **No scope creep / no regressions** — only this issue’s files changed; unrelated behavior is intact.
> 4. **Seam quality** — the code reused existing repo seams where possible and did not duplicate logic the PRD intended to centralize.
> 5. **Behavioral consistency** — public/editor/media/relation behavior matches the issue’s settled decisions and acceptance criteria.
> Do not fix the code. Report only confirmed or plausible findings with concrete file references and a short explanation of the risk.
