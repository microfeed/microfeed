# Content Type catalog — authoritative spec

> **Canonical source of truth for field names** for the registry (`edge-src/registry/ContentTypeRegistry.js`) and all consumers (mapper, validation, CRUD, feeds, admin forms, OpenAPI). Kept in-repo so offline sessions have it.
>
> **Naming decision (2026-07, blessed):** the implemented field keys here are the legacy microfeed public-API names (`content_html`, `url`, `date_published_ms`, `image`, `_microfeed.itunes:*`, flat `filter_tags`/`content_types`/`sort`/`limit`). The master-PRD draft (GitHub issue #1) used aspirational names (`body`, `link`, `pub_date`, `cover_image`, `intro`, nested `filter{}`, flat `itunes_*`). **These implemented names are authoritative — this file wins over the issue #1 draft** (see issue #1 comment recording the decision). Reason: legacy-API compatibility, internal consistency, and no external consumers require the cosmetic rename.

## Conventions
- **key** = public API / form field name (what payloads use).
- **target** = internal-schema key written to the item `data` blob (what feeds read). Legacy podcast targets are preserved so the podcast feed keeps working (`description`, `link`, `mediaFile`, `pubDateMs`, `image`, `itunes:*`).
- `status` is an `enum` on every type with valueMap `{published:1, unpublished:2, unlisted:4}`.
- Field kinds: text, richtext, media, image, boolean, number, date, enum, url, tags, reference, string_list.
- **rss** = optional per-type RSS flavor exposed by the registry (`getRssKind(typeName)` → `"itunes" | "basic" | null`), consumed by `FeedPublicRssBuilder`:
  - `podcast_episode` → `"itunes"` — full iTunes-tagged RSS 2.0 item (`itunes:*`, `<enclosure>`).
  - `blog_article` → `"basic"` — plain RSS 2.0 item (title/link/description/guid/pubDate only, no iTunes tags, no enclosure).
  - `photo`, `gallery`, `landing_page`, `home_page` → no `rss` key → `getRssKind` returns `null` → excluded from RSS entirely.

## podcast_episode (record) — feeds: JSON + iTunes RSS + web `/i/[slug]`
| key | kind | required | target |
|---|---|---|---|
| status | enum | – | status |
| title | text | ✅ | title |
| url | url | – | **link** |
| content_html | richtext | – | **description** |
| image | image | – | image |
| attachment | media | – | mediaFile |
| date_published_ms | date | – | pubDateMs |
| guid | text | – | guid |
| itunes:title | text | – | itunes:title (source `_microfeed.itunes:title`) |
| itunes:block | boolean | – | itunes:block (source `_microfeed.*`) |
| itunes:episodeType | enum(full,trailer,bonus) | – | itunes:episodeType (source `_microfeed.*`) |
| itunes:season | number(int,≥1) | – | itunes:season (source `_microfeed.*`) |
| itunes:episode | number(int,≥1) | – | itunes:episode (source `_microfeed.*`) |
| itunes:explicit | boolean | – | itunes:explicit (source `_microfeed.*`) |
| related_items | reference | – | related_items |

## blog_article (record) — feeds: JSON + blog RSS `/blog/rss` + web `/blog/[slug]`
| key | kind | required | target |
|---|---|---|---|
| status | enum | – | status |
| title | text | ✅ | title |
| content_html | richtext | ✅ | description |
| image | image | – | image (cover) |
| excerpt | text | – | excerpt |
| author | text | – | author |
| tags | tags | – | tags |
| date_published_ms | date | – | pubDateMs |
| related_items | reference | – | related_items |

## photo (record) — feeds: JSON + web `/photo/[slug]`
| key | kind | required | target |
|---|---|---|---|
| status | enum | – | status |
| title | text | – | title |
| image | image | ✅ | image |
| caption | text | – | caption |
| tags | tags | – | tags |
| taken_date | date | – | pubDateMs |
| related_items | reference | – | related_items |

## gallery (aggregator, explicit ordered Photos) — feeds: JSON + web `/gallery/[slug]`
| key | kind | required | target |
|---|---|---|---|
| status | enum | – | status |
| title | text | ✅ | title |
| content_html | richtext | – | description |
| image | image | – | image (cover) |
| members | reference | ✅ | members |
| tags | tags | – | tags |
| related_items | reference | – | related_items |

## landing_page (aggregator, dynamic filter) — feeds: web `/[slug]` + JSON
| key | kind | required | target |
|---|---|---|---|
| status | enum | – | status |
| title | text | ✅ | title |
| content_html | richtext | – | description (intro) |
| image | image | – | image |
| content_types | enum(multiple; podcast_episode,blog_article,photo) | – | content_types |
| filter_tags | string_list | – | filter_tags |
| sort | enum(newest_first,oldest_first) | – | sort |
| limit | number(int,≥1) | – | limit |
| layout | enum(list,grid) | – | layout |
| related_items | reference | – | related_items |

> `filter_tags` is a plain string list (kind `string_list`), not the relational `tags` field kind — it's filter *config* stored in the item's own `data` blob, not a tag link on the landing page item itself. `related_items` is the separate related-content relation field; it writes `related_content` rows in `item_relations` and is the only relational side effect landing pages participate in.

## home_page (singleton page) — feeds: web `/` + JSON
| key | kind | required | target |
|---|---|---|---|
| status | enum | – | status |
| title | text | ✅ | title |
| content_html | richtext | – | description (hero) |
| image | image | – | image |
| show_channel_title | boolean | – | show_channel_title |
| show_channel_description | boolean | – | show_channel_description |
| show_channel_image | boolean | – | show_channel_image |
| recent_content_types | enum(multiple; podcast_episode,blog_article,photo) | – | recent_content_types |
| recent_limit | number(int,≥1) | – | recent_limit |
| recent_show_date | boolean | – | recent_show_date |
| recent_show_excerpt | boolean | – | recent_show_excerpt |
| recent_show_badge | boolean | – | recent_show_badge |
| featured_title | text | – | featured_title |
| featured_items | reference | – | featured_items |
| filtered_title | text | – | filtered_title |
| content_types | enum(multiple; podcast_episode,blog_article,photo) | – | content_types |
| filter_tags | string_list | – | filter_tags |
| sort | enum(newest_first,oldest_first) | – | sort |
| limit | number(int,≥1) | – | limit |
| seo_title | text | – | seoTitle |
| seo_description | text | – | seoDescription |
| share_image | image | – | shareImage |
| noindex | boolean | – | noindex |

> `home_page` is a singleton. Its slug is fixed to `/` in the public route and is hidden from the normal authoring slug control.

## Corrections from the first Phase 2 pass (offline drift)
- Podcast `url`→**link** and `content_html`→**description** targets (were mapping to `url`/`content_html`).
- Added blog `author`, `excerpt`; photo `caption`, `taken_date`.
- Removed extraneous `url` from blog/photo/gallery/landing.
- Photo now uses `caption` + `taken_date` (not `content_html`/`date_published_ms`).
