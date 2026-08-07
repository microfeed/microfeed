---
title: Use the API with AI agents
description: Let a coding agent drive the local microfeed CLI while browser consent and destructive actions remain under your control.
---

The recommended agent workflow inside a microfeed clone is `yarn microfeed`,
the repository-local form of the official
[`@microfeed/cli` package](https://www.npmjs.com/package/@microfeed/cli). The
local workspace works after `yarn install`, so the agent does not need a global
CLI or permission to download one from a registry.

The clone also includes the `manage-microfeed-content` agent skill at
`.agents/skills/manage-microfeed-content/`. It is the agent-focused workflow
for CLI selection, vocabulary, browser-consent handoff, media uploads,
credential safety, and destructive-action confirmation. The published
`@microfeed/cli` tarball bundles the identical skill at
`dist/skills/manage-microfeed-content/` for agent hosts or skill installers
that distribute skills with npm packages. The top-level repository copy is the
source of truth; packaging tests require the bundled copy to match it.

When public API docs are enabled, each instance also publishes two plain-text files
for coding agents:

- [`/api/v1/llms.txt`](https://www.microfeed.org/api/v1/llms.txt) is a compact
  index of operations and links.
- [`/api/v1/llms-full.txt`](https://www.microfeed.org/api/v1/llms-full.txt) is a
  self-contained guide containing every operation,
  parameter, request body, response, reusable schema, and the complete OpenAPI
  3.1.1 document.

## Start with a content task

Tell the agent what to publish and which site to use. Do not send it a token.
For example:

```text
Use @microfeed/cli to create a published item on https://feed.example.com.
Use --json for deterministic output, and pause for me if browser authorization
or confirmation of a destructive action is required.
```

The agent should inspect command help, show you the selected site before a
destructive change, and return the resulting public item URL. You complete any
OAuth login and consent in the browser.

## Give an agent the contract

The microfeed.org demo keeps its reference public. Paste this prompt into an
agent that can read public URLs:

```text
Read https://www.microfeed.org/api/v1/llms-full.txt so I can ask you questions and build with this microfeed API.
```

For code that targets another microfeed instance, replace
`https://www.microfeed.org` with that site's URL so the agent reads the
contract for the deployed version it will call.

The dashboard’s **API Overview** page generates the exact prompt for the
current instance and provides a copy button.

The contract contains the instruction to send
`Authorization: Bearer YOUR_CREDENTIAL`; it does not contain a real key or
OAuth token.

## Keep the credential separate

Ask the agent to use `yarn microfeed --json` and JSON file or standard-input
payloads. The CLI obtains and refreshes OAuth credentials internally. Do not
ask the agent to read its encrypted credential file or operating-system
keychain.

Use the user's vocabulary carefully. An **item image** is cover art or a
thumbnail. A **media attachment** is the item's one main audio, video,
document, or image file; it becomes JSON Feed `attachments[0]` and the RSS
enclosure. **Standalone media** is an uploaded file that has not been assigned
to either field, such as an image embedded inside `content_html`.

When the user asks to attach or enclose a file, use `item create
--attachment-file <path>` or `item update <item-id> --attachment-file <path>`.
Use `--image-file <path>` only for item cover art or a thumbnail. For an inline
rich-text image, use `media upload <path> --json`, read its permanent
`media_url`, insert that URL in `content_html`, and then save the item. Do not
script, read, or print the short-lived upload URL, and do not treat `--image
<url>` as a local-file option. Prefer `--json` for deterministic results.

If `yarn microfeed login <site-url>` is required, the agent may start it, but you
must sign in and approve or deny permissions in the browser. The agent must
pause for that step and must not click **Allow** on your behalf.

Do not paste an API key, access token, refresh token, or client secret into the
agent conversation. For CI, provide `MICROFEED_API_KEY` through the secret
manager and instruct the agent to reference the variable without reading or
printing its value.

Before deleting content, have the agent report the selected saved-instance
name and exact item ID. Approve the operation explicitly; the agent can then pass
the same ID to `--confirm`. The CLI will not accept a generic yes flag.

See [Manage content with the microfeed CLI](../cli/) for the guided workflow
and the canonical [`yarn microfeed` command reference](/microfeed-cli/) for
every command, option, output contract, and safety rule.

## When public docs are off

An owner can keep the authenticated API enabled while making all documentation
URLs return 404. In that case, download or inspect the generated contract from
an authorized workflow and provide it to the agent as a local file. Do not turn
public docs on merely to work around an agent that cannot receive the contract
safely.
