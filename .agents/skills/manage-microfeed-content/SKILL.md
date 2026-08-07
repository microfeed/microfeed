---
name: manage-microfeed-content
description: Manage content on one or more microfeed sites through @microfeed/cli. Use when an agent is asked to log in to a microfeed site; select a saved site; list, read, create, update, or delete items; upload item cover art or a media attachment/RSS enclosure; or call the authenticated microfeed REST API.
---

# Manage microfeed content

Use the `microfeed` CLI so credentials, OAuth refresh, upload URLs, redirects,
and output safety remain inside the project-owned client.

## Choose the invocation

1. Inside a microfeed clone, use `yarn microfeed` after the normal
   `yarn install`.
2. In a project with `@microfeed/cli` installed locally, use
   `yarn microfeed`.
3. Use `yarn dlx @microfeed/cli` only for intentional one-off use when a local
   package is unavailable.

Before using an unfamiliar command or option, run its `--help`. Inside a clone,
read `../../../docs/microfeed-cli.md` for the canonical reference. Outside a
clone, use <https://docs.microfeed.org/microfeed-cli/>.

## Use microfeed vocabulary precisely

- **Site URL**: the root public URL of one microfeed site, such as
  `https://feed.example.com`. Do not include a dashboard path. Local testing may
  use `http://127.0.0.1:<port>`.
- **Instance name**: a local alias for a saved site, such as `production` or
  `local`. It is not a username, account, OAuth identity, or Wrangler profile.
- **Item ID**: the stable ID returned by `item list` or `item get`.
- **Item image**: cover art or a thumbnail stored in the top-level `image`
  field. Use `--image-file <path>` for a local file or `--image <url>` for an
  already-hosted absolute URL.
- **Media attachment**: the item's one main audio, video, document, image, or
  external link. It is JSON Feed `attachments[0]` and the RSS enclosure. Use
  `--attachment-file <path>` for a local file.

When a user says “upload,” “attach,” “media file,” or “enclosure,” default to a
media attachment. Use an item image only when the user says cover, artwork,
thumbnail, item image, or equivalent. If their intent remains ambiguous and
would change which field is written, ask before uploading.

## Select and authorize a site

Start with:

```console
yarn microfeed instances list --json
```

Use the named site the user supplied. If several saved sites exist and the
target is unclear, show their instance names and site URLs and ask the user to
choose. Never silently select the first one.

When authorization is missing, run:

```console
yarn microfeed login <site-url> --instance <name>
```

Tell the user that browser administrator sign-in and consent are required,
then pause. The user must approve or deny access; do not click **Allow** for
them. Never ask the user to paste a credential into chat.

## Operate deterministically

- Add `--instance <name>` when the target is not already unambiguous.
- Add `--json` when an agent or program consumes the result.
- Prefer common flags for short, simple values. Prefer `--input <file|->` for a
  complete JSON object or fields that have no flag. Do not combine `--input`
  with item flags.
- Treat `--content-html` as the item's description/body.
- Use `published`, `unlisted`, or `unpublished` for status.
- Read response fields rather than scraping dashboard HTML.

Common operations:

```console
yarn microfeed item list --instance <name> --json
yarn microfeed item get <item-id> --instance <name> --json
yarn microfeed item create --instance <name> --title "Title" \
  --content-html "<p>Body</p>" --status unlisted --json
yarn microfeed item update <item-id> --instance <name> \
  --status published --json
```

## Upload files safely

For a main media attachment/RSS enclosure:

```console
yarn microfeed item update <item-id> --instance <name> \
  --attachment-file ./episode.mp3 --json
```

For item cover art or a thumbnail:

```console
yarn microfeed item update <item-id> --instance <name> \
  --image-file ./cover.png --json
```

Do not construct, follow, copy, persist, or print a presigned upload URL. The
CLI sends file bytes without a Bearer credential and refuses cross-site upload
URLs and redirects.

Creating with `--attachment-file` is a create-upload-update sequence because
the attachment requires an item ID. If upload or update fails after creation,
report the created item ID and inspect it before retrying. Do not create another
item blindly.

## Protect credentials and destructive actions

- Never request, read, print, log, copy, or expose API keys, OAuth access or
  refresh tokens, client secrets, encrypted credential files, or keychain
  entries.
- Let `MICROFEED_API_KEY` and `MICROFEED_URL` remain opaque environment inputs
  in CI. Never persist them.
- Before deletion, report the exact instance name, site URL, and item ID;
  explain that deletion is permanent; and obtain explicit approval. Then use:

  ```console
  yarn microfeed item delete <item-id> --instance <name> \
    --confirm <item-id> --json
  ```

- A `404` can mean the resource is absent or API access is disabled. Do not
  infer which one without further evidence.

For a REST operation that has no dedicated command, use `yarn microfeed api`
with a relative `/api/v1/...` path. Never supply `Authorization`, `Cookie`, or
`Host`; the CLI manages credentials and refuses redirects.
