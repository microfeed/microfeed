---
name: manage-microfeed-content
description: Manage content on one or more microfeed sites through @microfeed/cli. Use when an agent is asked to log in to a microfeed site; select a saved site; list, read, create, update, or delete items; upload standalone or inline media, item cover art, or a media attachment/RSS enclosure; or call the authenticated microfeed REST API.
---

# Manage microfeed content

Use the `microfeed` CLI so credentials, browser authorization, upload URLs, redirects,
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
  `local`. It is not a username, account, browser identity, or Wrangler profile.
- **Connection name**: this computer's label under **Account settings → App
  access**, such as `Home Mac`. It is not the local instance name. One site can
  show several computer connections for the same microfeed CLI application.
- **Item ID**: the stable ID returned by `item list`, `item search`, or
  `item get`.
- **Item image**: cover art or a thumbnail stored in the top-level `image`
  field. Use `--image-file <path>` for a local file or `--image <url>` for an
  already-hosted absolute URL.
- **Media attachment**: the item's one main audio, video, document, image, or
  external link. It is JSON Feed `attachments[0]` and the RSS enclosure. Use
  `--attachment-file <path>` for a local file.
- **Standalone media**: an uploaded file not assigned to either item field,
  such as an image embedded inside `content_html`. Use `media upload <path>`
  and read its permanent `media_url`.

When a user says “attach,” “media file,” or “enclosure,” default to a media
attachment. When they say insert, embed, inline, description image, or rich-text
image, use standalone media. Use an item image only when they say cover,
artwork, thumbnail, item image, or equivalent. If their intent remains
ambiguous and would change which field is written, ask before uploading.

## Select and authorize a site

Start with:

```console
yarn microfeed instances list --json
```

Use the named site the user supplied. If several saved sites exist and the
target is unclear, show their instance names and site URLs and ask the user to
choose. Never silently select the first one.

New microfeed instances keep API access disabled by default. Browser login may
succeed while content commands still return `404`. When that happens, pause
and ask the site owner to sign in to the admin dashboard, open **API → API
Settings**, and turn on **Enable API access**. This is a browser-only owner
action. Never ask for the dashboard password, an API key, or a CLI credential.
After the owner confirms access is enabled, retry the same content command;
the saved browser login does not need to be recreated.

Browser OAuth also requires the site's built-in login. Cloudflare Access may
protect routes, but it does not create the microfeed application session OAuth
needs. If the CLI reports that OAuth authorization is unavailable, tell the
owner to run `yarn manage auth setup` from the connected repository, then retry
login. Newer sites report this capability explicitly; follow the CLI's
compatible setup guidance for older sites that do not.

When authorization is missing, run:

```console
yarn microfeed login <site-url> --instance <name> \
  --connection-name <computer-name>
```

Tell the user that browser administrator sign-in and consent are required,
then pause. The user must approve or deny access; do not click **Allow** for
them. Never ask the user to paste a credential into chat. If the user does not
choose a connection name, let the CLI use the computer hostname; do not invent
an owner identity. Re-login reuses the saved connection ID and should not
create a duplicate entry for that computer.

`logout` revokes this computer's token family and removes the local saved
instance. It intentionally leaves the authorization visible as **Inactive**
under **Account settings → App access** until the owner revokes it. Do not
promise that logout removes the App access entry.

## Operate deterministically

- Add `--instance <name>` when the target is not already unambiguous.
- Add `--json` when an agent or program consumes the result.
- Prefer `item list --summary` and `item get --unwrap` to avoid loading channel
  metadata or unrequested content. Add `--fields` only with the corresponding
  compact flag.
- Prefer common flags for short, simple values. Prefer `--input <file|->` for a
  complete JSON object or fields that have no flag. Do not combine `--input`
  with item flags.
- Before a create when server-accurate validation is useful, run the same input
  with `--validate-only`. It authenticates to the target but does not write an
  item, upload a file, or invalidate caches.
- Generate one UUID for each logical item creation, pass it with
  `--idempotency-key`, and reuse that exact key and payload for every retry.
  Never generate a new key merely because a network request is retried.
- Add `--verify` to creates so the completed item is read back after any media
  workflow. If verification fails, report the already-created ID and inspect or
  retry the read; do not create another item.
- Treat `--content-html` as the item's description/body.
- Use `published`, `unlisted`, or `unpublished` for status.
- Read response fields rather than scraping dashboard HTML.

Common operations:

```console
yarn microfeed item list --summary --instance <name> --json
yarn microfeed item search "hello" --fields title --instance <name> --json
yarn microfeed item get <item-id> --unwrap --instance <name> --json
yarn microfeed item create --instance <name> --input item.json \
  --validate-only --json
yarn microfeed item create --instance <name> --title "Title" \
  --content-html "<p>Body</p>" --status unlisted \
  --idempotency-key <logical-create-uuid> --verify --json
yarn microfeed item update <item-id> --instance <name> \
  --status published --json
```

## Upload files safely

For an image embedded in the description or other rich HTML:

```console
yarn microfeed media upload ./diagram.png --instance <name> --json
```

Read only the permanent `media_url`, insert it into an `<img src>` in
`content_html`, and create or update the item. The upload command does not edit
the item. Reference the returned URL promptly so the standalone object is not
left unused. Images need no item ID. For standalone audio, video, or documents,
pass `--item-id <item-id>` as required by the REST contract.

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

Do not construct, follow, copy, persist, read, or print a presigned upload URL.
The CLI sends file bytes without a Bearer credential and refuses cross-site
upload URLs and redirects.

Creating with `--attachment-file` is a create-upload-update sequence because
the attachment requires an item ID. If upload or update fails after creation,
report the created item ID and inspect it before retrying. Reuse the original
logical create's idempotency key and payload; do not create another item
blindly. `--verify` reads the item only after the attachment update succeeds.

## Protect credentials and destructive actions

- Never request, read, print, log, copy, or expose API keys, CLI access or
  refresh credentials, encrypted credential files, or keychain
  entries.
- Let `MICROFEED_API_KEY` and `MICROFEED_URL` remain opaque environment inputs
  in CI. Never persist them.
- Before deletion, report the exact instance name, site URL, and item ID;
  explain that deletion is permanent; and obtain explicit approval. Then use:

  ```console
  yarn microfeed item delete <item-id> --instance <name> \
    --confirm <item-id> --json
  ```

- A `404` can mean the resource is absent or API access is disabled. Follow the
  CLI's `recovery` instructions: pause for the owner to enable access under
  **API → API Settings**, then retry the same command. If access is already on,
  verify the resource and `/api/v1/` path instead of repeatedly retrying.

For a REST operation that has no dedicated command, use `yarn microfeed api`
with a relative `/api/v1/...` path. Never supply `Authorization`, `Cookie`, or
`Host`; the CLI manages credentials and refuses redirects.
