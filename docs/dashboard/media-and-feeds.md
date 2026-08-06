---
title: Media and feeds
description: Configure subscribe methods, media file URLs, public feed ordering, and the favicon under Settings.
---

Open **Settings** for the controls on this page. Editing the channel’s image,
title, publisher, website, categories, language, or description happens on the
separate [Edit channel](/dashboard/edit-channel/) page.

## Subscribe methods

Select **Subscribe methods** in the settings navigation. Subscribe methods are
public destinations such as RSS, JSON, Apple Podcasts, or another listening
service. For each method, set its name, URL, visibility, and order. Only
advertise a destination you have verified.

## Media file storage

The R2 public bucket URL tells public pages how to reach uploaded files. Change
it only when the bucket’s public address or custom media domain changes. Select
**Update** beside the field and verify an existing image afterward.

The deployment’s R2 binding is managed by `yarn manage`; the dashboard field
does not create or attach a bucket.

## Items settings

Choose the default sort field and order for the public feed. Those radio choices
save when changed. Set **Items per page** and select its adjacent **Update**
button to save a new page size.

Changing presentation order does not rewrite the items themselves.

## Favicon

Without a separate favicon, public pages use the channel image. Upload, replace,
or delete the favicon from its settings section; the action saves immediately.
Browsers cache favicons aggressively, so a replacement may need a hard refresh
or a new private window before it appears.

