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

The media address tells public pages how to reach uploaded files stored in R2.
Most sites should leave it unchanged. Update it only when you deliberately
change the bucket’s public address or add a custom media domain, then open an
existing image to verify the new address.

The deployment’s R2 connection is managed by `yarn manage`; changing this text
field does not create, attach, or move a bucket or any files.

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
