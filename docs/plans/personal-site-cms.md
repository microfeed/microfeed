---
title: Personal Website CMS features for cms.kiranbrahma.com
description: Plan for categories, series, contact form, media manager, and a new personal-site theme for the cms.kiranbrahma.com microfeed instance.
---

# PRD: Personal Website CMS features for cms.kiranbrahma.com

Status: Draft
Owner: kiran-brahma
Branch: `feature/personal-site-cms`
Target: fork `kiran-brahma/microfeed` (personal features; not upstream microfeed)

## Problem Statement

Kiran runs a personal website on microfeed at `cms.kiranbrahma.com`. The bundled
default theme is podcast-first, but Kiran is primarily a writer. He needs the
site to work as a personal website while still supporting podcast content. Today
he cannot:

- Categorize a post or organize posts into a series (only podcast-specific
  iTunes fields exist).
- Let visitors contact him through a simple form (name / email / message).
- Reuse an uploaded image across posts — every post re-uploads its own copy.
- Control image size — every image is 1:1 but is not converted to a compact
  format, so media storage grows quickly.

## Solution

Add a set of personal-website features to microfeed, each delivered as its own
PR:

1. **Categories** — a managed list of categories stored in the database, shown
   in Admin, assignable to a post (max 2 per post).
2. **Series** — a managed list of series stored in the database, shown in Admin.
   Series are typed (`post` or `podcast`) so posts and podcasts have separate
   series. Each item in a series gets a series number.
3. **Contact form** — a public form (name / email / message) that saves
   submissions to a new database table, viewable in Admin.
4. **Media manager** — a global media library in Admin. Upload once, then reuse
   any image as a post cover, inline image, or attachment. Images are kept at a
   1:1 aspect ratio and converted to AVIF to limit size.
5. **New theme** — a clean, minimal, writing-first theme that keeps podcast
   support and includes the contact form.

## User Stories

1. As a site owner, I want to create, rename, and delete categories in Admin, so
   that I can organize my writing.
2. As a site owner, I want to assign up to 2 categories to a post, so that
   readers can find related writing.
3. As a site owner, I want to create, rename, and delete series in Admin, so
   that I can group posts into a sequence.
4. As a site owner, I want series to be typed as `post` or `podcast`, so that
   my writing series and podcast series stay separate.
5. As a site owner, I want to assign a post to a series and give it a series
   number, so that readers can follow the sequence.
6. As a site owner, I want a public contact form (name / email / message), so
   that visitors can reach me.
7. As a site owner, I want contact submissions stored in the database and
   viewable in Admin, so that I can read and respond to messages.
8. As a site owner, I want a global media library in Admin, so that I can see
   every uploaded image in one place.
9. As a site owner, I want to upload an image once and reuse it as a post cover,
   inline image, or attachment, so that I do not re-upload the same image.
10. As a site owner, I want uploaded images kept at a 1:1 aspect ratio and
    converted to AVIF, so that media storage stays small.
11. As a visitor, I want a clean, minimal, writing-first site, so that reading
    is comfortable.
12. As a visitor, I want podcast content still available, so that I can listen
    to episodes.
13. As a visitor, I want to see a post's categories and series, so that I can
    explore related content.

## Implementation Decisions

- **Data model**: new tables `categories`, `series`, `item_categories`,
  `item_series`, `contact_messages`, and `media_library`, added via a new D1
  migration. `series.kind` distinguishes `post` vs `podcast`. `item_categories`
  enforces a max of 2 categories per item. `item_series` stores the series
  number.
- **Admin**: new Admin pages for Categories, Series, Contact Messages, and
  Media Library, following the existing Admin routing and component patterns.
- **Item editor**: add category picker (max 2), series picker, and series number
  to the existing item editor, alongside the existing podcast-specific fields.
- **Contact form**: a public endpoint that validates and inserts into
  `contact_messages`; an Admin page lists and manages submissions.
- **Media manager**: a global library backed by `media_library`; the item editor
  and rich-text editor can pick from the library instead of re-uploading.
- **Image pipeline**: uploaded images are normalized to a 1:1 crop and converted
  to AVIF before storage.
- **Theme**: a new clean minimal theme (separate package) that is writing-first,
  keeps podcast support, and renders categories, series, and the contact form.
- **AGENTS.md**: record these features so future AI sessions do not overwrite
  them when syncing upstream changes.

## Testing Decisions

- Each new Admin/API surface gets contract and runtime tests following the
  existing patterns in the repo (see `src/shared/ApiSchemas.ts` and the OpenAPI
  document).
- Migrations are exercised by the existing migration test workflow.
- The new theme is validated and tested with `theme-kit validate` and
  `theme-kit test`, and previewed before installation.
- Tests assert external behavior (a category is assignable, a message is saved,
  an image is reusable and AVIF) rather than implementation details.

## Out of Scope

- Email delivery of contact submissions (stored in DB only for now).
- Multi-image galleries per post.
- Non-1:1 image crops.
- Upstream contribution of these personal features to `microfeed/microfeed`.

## Further Notes

- Each feature ships as its own PR so it can be reviewed and merged
  independently.
- The footer "Powered by microfeed" removal is a separate small change already
  prepared on this branch.
