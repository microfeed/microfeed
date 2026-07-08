# PRD — Image Pipeline and Unified Brand Model

**Branch:** cut a new feature branch from `main`.  
**Companion:** [PRD_PERSONAL_SITE_EXECUTION_INDEX.md](./PRD_PERSONAL_SITE_EXECUTION_INDEX.md)

---

## 1. Goal

Make image handling consistent and personal-site oriented:

1. Every non-animated raster image uploaded through an image field is cropped to `1:1`, resized to a maximum of `1024x1024`, and stored as AVIF.
2. Animated images remain allowed in image fields, but bypass AVIF normalization.
3. SVG remains allowed untouched.
4. One shared upload flow owns image cropping, normalization, validation, replacement, and metadata handoff.
5. `channel.image` becomes the single canonical global brand/public image field.
6. Public rendering uses consistent square-first image presentation and logo rules.

This PRD is the foundation for the later home-page, editor, and related-content work.

---

## 2. Settled decisions

| Area | Decision |
|------|----------|
| Base branch | Start from `main`, not `rebuild/cms`. |
| Image-field scope | Applies to every image field except favicon. Includes `channel.image`, item `image`, SEO/share images, publisher logo, and any later home-page image fields. |
| Favicon | Out of scope for this pipeline; keep separate behavior. |
| Raster output | Non-animated raster output is AVIF only. |
| SVG | Allowed untouched; not transcoded to AVIF. |
| Animated images | Allowed in image fields and bypass AVIF normalization. |
| Crop policy | All non-animated image-field uploads go through a shared 1:1 cropper flow. |
| Size policy | Final non-animated raster output must be max `1024x1024`; smaller images are not upscaled. |
| Quality | AVIF target quality starts at `80`, but implementation may reduce bytes if visual quality remains web-publishable. |
| Replacement | Replacing an existing image uses the new normalization pipeline. |
| Existing media | Existing media objects stay as-is; the new pipeline affects future uploads and replacements only. |
| Metadata | Persist final metadata only. |
| Global brand source | `channel.image` is the single canonical global brand/public image field. |
| Logo rendering | Public logo renders inside a square box capped at `50x50`, preserving aspect ratio with letterboxing. |
| Public image styling | Card/list/grid images are hard `1:1`. Home hero remains supported as a large public surface using the same canonical image source. |

---

## 3. Architecture context (read first)

- `client-src/components/AdminImageUploaderApp/index.jsx`
- `client-src/components/FormRenderer/widgets/ImageUploadWidget.jsx`
- `client-src/common/requests.js`
- `client-src/components/MediaLibraryPicker/index.jsx`
- `client-src/ClientAdminChannelApp/components/EditChannelApp/index.jsx`
- `client-src/ClientAdminSettingsApp/components/SeoSettingsApp/index.jsx`
- `client-src/ClientAdminSettingsApp/components/WebGlobalSettingsApp/index.jsx`
- `edge-src/models/MediaService.js`
- `edge-src/models/MediaRepo.js`
- `edge-src/web/publicChannel.js`
- `edge-src/web/RecordPageLayout.jsx`
- `edge-src/web/HomePage.jsx`
- `edge-src/web/ItemCard.jsx`
- `edge-src/web/LandingPage.jsx`
- `edge-src/web/GalleryPage.jsx`
- `edge-src/web/seo/buildSeo.js`

Current friction to eliminate:

- one uploader crops square and hardcodes PNG output
- another uploader bypasses cropping and normalization
- image-field behavior differs by screen
- brand/logo/public image precedence is split across channel/settings/SEO code
- public image presentation rules are spread across multiple page modules

---

## 4. Deliverables

### 4.1 Shared client-side image pipeline module

Build one shared client-side image pipeline module for image-field uploads.

Its interface must cover:

- file selection
- file-type classification
- animated-image detection
- SVG passthrough
- non-animated raster decode
- 1:1 crop flow
- max-dimension resize
- AVIF encode
- final metadata extraction
- handoff to existing upload transport

The implementation must centralize policy so callers do not decide crop ratio, format, max size, or replacement behavior on their own.

### 4.2 Shared image-field uploader flow

Refactor all image-field entry points to use the same shared flow:

- channel image
- schema-driven `image` widget
- SEO default share image
- SEO publisher logo
- any other image-setting uploader except favicon

Media-library reuse remains supported, but selecting an existing asset should only accept assets that already satisfy the image-field contract, or clearly preserve the exception rules for SVG/animated assets.

### 4.3 Replacement path normalization

When an existing image is replaced, the same image pipeline applies before object overwrite.

The replacement path must preserve:

- existing reference URL when replacing in place
- final metadata refresh
- shared validation behavior

### 4.4 Unified canonical brand/public image model

Remove active public reliance on separate brand-logo image settings.

Public surfaces must use `channel.image` as the canonical source for:

- nav/logo image
- home hero image
- fallback public brand image usage

SEO/share image precedence may still fall back to specific SEO fields first, but when a general brand/public image is needed, `channel.image` is the canonical field.

### 4.5 Public presentation cleanup

Consolidate the public image presentation rules so that:

- nav/logo uses a `50x50` square box with letterboxing
- cards use square thumbnails consistently
- gallery and landing grid thumbs use the same square-first rule
- home item feed uses the same shared card presentation rules
- the canonical brand/public image source flows cleanly into `publicChannel` and SEO helpers

---

## 5. Implementation slices inside this issue

Implement in this order inside the same branch/PR:

1. Extract the shared image pipeline module and cover it with focused tests.
2. Rewire image-field uploaders to use it.
3. Rewire image replacement to use it.
4. Unify canonical brand/public image source usage.
5. Clean up public presentation rules that depend on the canonical image source.

Do not start the home-page or editor-workspace PRDs in this issue.

---

## 6. Tests to write first

Write failing tests before code for these seams:

1. Shared image pipeline module:
   - raster input becomes AVIF
   - output is max `1024x1024`
   - smaller images are not upscaled
   - crop result is square
   - SVG passes through untouched
   - animated image bypasses AVIF normalization
2. Shared image widget/uploader behavior:
   - all image-field callers use the shared flow
   - replacement path uses the same normalization
3. Media metadata:
   - final stored metadata reflects final output, not original input
4. Public rendering:
   - logo renders within a `50x50` letterboxed box
   - card images render consistently as square thumbnails
5. Canonical image source:
   - public surfaces use `channel.image`
   - old separate brand-logo image settings are no longer the active public source

### Prior art

- `client-src/components/AdminRichEditor/AdminRichEditor.test.jsx`
- `client-src/components/FormRenderer/widgets/MediaWidgets.test.jsx`
- `edge-src/web/HomePage.test.js`
- `edge-src/web/PublicNav.test.js`
- `edge-src/web/publicChannel.test.js`
- `edge-src/web/seo/buildSeo.test.js`
- `edge-src/models/MediaService.test.js`

---

## 7. Review protocol

In addition to the global review prompt, the review must specifically verify:

- no image-field caller still owns its own crop/format/max-size rules
- no public surface still depends on a second brand-image source
- animated and SVG exception rules are preserved exactly as specified
- no favicon behavior was unintentionally changed

---

## 8. Out of scope

- favicon redesign or favicon format changes
- home-page singleton data model
- editor workspace layout
- TipTap toolbar expansion
- related-content data model
- migration of existing stored media objects

---

## 9. Acceptance

- Every non-animated raster image-field upload becomes square AVIF at max `1024x1024`.
- SVG remains allowed untouched.
- Animated image uploads remain allowed and bypass AVIF normalization.
- Replacements use the same pipeline.
- Existing media remains unchanged until replaced.
- `channel.image` is the single active canonical global brand/public image field.
- Public logo presentation is `50x50` max with letterboxing.
- Square thumbnail behavior is consistent across public card/list/grid rendering.
- `yarn test` is green and the outsourced review reports no unresolved confirmed/plausible findings.
